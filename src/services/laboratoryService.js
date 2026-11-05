import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ROLES } from '../lib/roles';
import {
  LAB_ORDER_STATUS,
  MATERIALS_STATUS,
  DISPATCH_SUB_STATUS,
  INPUT_SUBMISSION_TYPES,
  DEFAULT_WORKFLOW_TEMPLATES,
  inferCategoryAndWorkflow,
  getWorkflowTemplate,
  reconcileLabOrder,
  validateWorkflowTransition,
} from '../lib/labWorkflows';
import { activityLogService } from './activityLogService';
import { notificationService } from './notificationService';

function toIsoDate(val, fallbackIso = null) {
  if (!val) return fallbackIso;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'object' && typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return val;
}

function normalizeRawDoc(d, customTemplatesMap = {}) {
  const data = d.data();
  const nowIso = new Date().toISOString();
  const base = {
    id: d.id,
    ...data,
    createdAt: toIsoDate(data.createdAt, nowIso),
    updatedAt: toIsoDate(data.updatedAt, null),
    acceptedAt: toIsoDate(data.acceptedAt, null),
    materialsReceivedAt: toIsoDate(data.materialsReceivedAt, null),
    productionStartedAt: toIsoDate(data.productionStartedAt, null),
    qcCompletedAt: toIsoDate(data.qcCompletedAt, null),
    readyAt: toIsoDate(data.readyAt, null),
    dispatchedAt: toIsoDate(data.dispatchedAt, null),
    completedAt: toIsoDate(data.completedAt, null),
  };
  return reconcileLabOrder(base, customTemplatesMap);
}

/**
 * Enforces vendor/laboratory scoping for external partner lab accounts
 */
function canViewerAccessOrder(order, viewer) {
  if (!viewer || !order) return true;
  if (viewer.role === ROLES.PATIENT) return false;
  if (viewer.role === ROLES.LAB_TECH && viewer.assignedVendor) {
    return order.vendor === viewer.assignedVendor;
  }
  return true;
}

async function resolveActorContext(explicitActor = {}) {
  const uid = explicitActor.uid || explicitActor.id || auth?.currentUser?.uid || '';
  let profile = null;
  if (db && uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        profile = snap.data();
      }
    } catch {
      // fallback to explicit actor metadata if offline
    }
  }

  return {
    uid,
    name:
      profile?.fullName ||
      explicitActor.fullName ||
      explicitActor.name ||
      (typeof explicitActor === 'string' ? explicitActor : '') ||
      'Authorized Staff',
    role: profile?.role || explicitActor.role || ROLES.LAB_TECH,
    assignedVendor: profile?.assignedVendor || explicitActor.assignedVendor || '',
  };
}

function makeTimelineEvent({ step, status, title, detail = '', actorName, actorRole }) {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    step,
    status,
    title,
    detail,
    actorName,
    actorRole,
    timestamp: new Date().toISOString(),
  };
}

function makeCommunicationEntry({ type, message, actorName, actorRole }) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type, // 'CLARIFICATION_REQUEST' | 'CLINIC_RESPONSE' | 'LAB_UPDATE' | 'TRY_IN' | 'ISSUE_REPORT' | 'ISSUE_RESOLUTION'
    message,
    actorName,
    actorRole,
    timestamp: new Date().toISOString(),
  };
}

async function notifyLabStaff(title, message, targetVendor = '') {
  if (!db) return;
  try {
    const q = query(collection(db, 'users'), where('role', '==', ROLES.LAB_TECH));
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach((userDoc) => {
      const u = userDoc.data();
      if (u.deactivated) return;
      if (u.assignedVendor && targetVendor && u.assignedVendor !== targetVendor) return;
      promises.push(
        notificationService.create({
          userId: userDoc.id,
          title,
          message,
          type: 'LAB_ORDER',
        })
      );
    });
    await Promise.allSettled(promises);
  } catch (err) {
    console.warn('Non-critical lab notification warning:', err);
  }
}

async function notifyDentist(dentistId, title, message) {
  if (!db || !dentistId) return;
  try {
    await notificationService.create({
      userId: dentistId,
      title,
      message,
      type: 'LAB_ORDER',
    });
  } catch (err) {
    console.warn('Non-critical dentist notification warning:', err);
  }
}

export const laboratoryService = {
  /**
   * Fetches custom Workflow E / service templates from Firestore merged with built-in templates
   */
  async getWorkflowTemplatesMap() {
    const map = { ...DEFAULT_WORKFLOW_TEMPLATES };
    if (!db) return map;
    try {
      const snap = await getDocs(collection(db, 'labWorkflows'));
      snap.forEach((d) => {
        const data = d.data();
        if (data && Array.isArray(data.stages) && data.stages.length > 0) {
          map[d.id] = { id: d.id, ...data };
        }
      });
    } catch {
      // Safe fallback to built-in templates if collection hasn't been provisioned yet
    }
    return map;
  },

  /**
   * Real-time subscription to workflow templates (built-in + Firestore custom templates)
   */
  subscribeWorkflowTemplates(callback) {
    if (!db) {
      callback({ ...DEFAULT_WORKFLOW_TEMPLATES });
      return () => {};
    }

    return onSnapshot(
      collection(db, 'labWorkflows'),
      (snap) => {
        const merged = { ...DEFAULT_WORKFLOW_TEMPLATES };
        snap.forEach((d) => {
          const data = d.data();
          if (data && Array.isArray(data.stages) && data.stages.length > 0) {
            merged[d.id] = { id: d.id, ...data };
          }
        });
        callback(merged);
      },
      () => {
        callback({ ...DEFAULT_WORKFLOW_TEMPLATES });
      }
    );
  },

  /**
   * Saves or updates a configurable workflow template in Firestore (Admin / Lab Admin only)
   */
  async saveWorkflowTemplate(templateData, actorInput = {}) {
    if (!db) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only Laboratory Administrators or Clinic Administrators can configure workflow templates.');
    }

    const templateId =
      templateData.id ||
      `CUSTOM_${String(templateData.shortName || templateData.name || 'WORKFLOW')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .slice(0, 24)}_${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const prodStages = (templateData.productionStepLabels || [])
      .map((lbl, idx) => {
        const trimmed = String(lbl || '').trim();
        if (!trimmed) return null;
        return {
          key: `STEP_${idx + 1}_${trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 18)}`,
          label: trimmed,
          phase: 'PRODUCTION',
          desc: 'Configured laboratory fabrication stage',
        };
      })
      .filter(Boolean);

    if (prodStages.length === 0) {
      throw new Error('Please define at least one fabrication stage.');
    }

    const stages = [
      ...prodStages,
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Specification & workmanship verification' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Ready for pickup or clinic dispatch' },
    ];

    const payload = {
      id: templateId,
      name: templateData.name?.trim() || 'Custom Appliance Workflow',
      shortName: templateData.shortName?.trim() || templateData.name?.trim() || 'Custom Workflow',
      category: templateData.category || 'OTHER',
      description: templateData.description?.trim() || 'Administrator-configured laboratory workflow template.',
      supportsTryIn: Boolean(templateData.supportsTryIn),
      isBuiltIn: Boolean(DEFAULT_WORKFLOW_TEMPLATES[templateId]?.isBuiltIn),
      stages,
      updatedBy: actor.name,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'labWorkflows', templateId), payload, { merge: true });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'SAVED_LAB_WORKFLOW_TEMPLATE',
      resourceType: 'LAB_WORKFLOW',
      resourceId: templateId,
      entity: `Configured laboratory workflow template: ${payload.name} (${prodStages.length} fabrication steps)`,
    });

    return payload;
  },

  /**
   * Retrieves all authorized laboratory orders once
   */
  async list(viewer = null) {
    if (!db) return [];
    const templatesMap = await this.getWorkflowTemplatesMap();
    const ordersRef =
      viewer?.role === ROLES.LAB_TECH && viewer?.assignedVendor
        ? query(collection(db, 'labOrders'), where('vendor', '==', viewer.assignedVendor))
        : collection(db, 'labOrders');
    const snapshot = await getDocs(ordersRef);
    const list = [];
    snapshot.forEach((d) => {
      const order = normalizeRawDoc(d, templatesMap);
      if (canViewerAccessOrder(order, viewer)) {
        list.push(order);
      }
    });
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Retrieves a single reconciled laboratory order by ID
   */
  async getById(orderId, viewer = null) {
    if (!db || !orderId) throw new Error('Order ID is required.');
    const [templatesMap, snap] = await Promise.all([
      this.getWorkflowTemplatesMap(),
      getDoc(doc(db, 'labOrders', orderId)),
    ]);
    if (!snap.exists()) throw new Error('Laboratory request not found.');
    const order = normalizeRawDoc(snap, templatesMap);
    if (!canViewerAccessOrder(order, viewer)) {
      throw new Error('Unauthorized: You do not have permission to view this laboratory case.');
    }
    return order;
  },

  /**
   * Real-time subscription to a single laboratory order
   */
  subscribeById(orderId, viewer, callback, onError) {
    if (!db || !orderId) {
      callback(null);
      return () => {};
    }

    let templatesMap = { ...DEFAULT_WORKFLOW_TEMPLATES };
    this.getWorkflowTemplatesMap().then((m) => {
      templatesMap = m;
    });

    return onSnapshot(
      doc(db, 'labOrders', orderId),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const order = normalizeRawDoc(snap, templatesMap);
        if (!canViewerAccessOrder(order, viewer)) {
          if (onError) onError(new Error('Unauthorized laboratory access.'));
          callback(null);
          return;
        }
        callback(order);
      },
      (err) => {
        console.error('Realtime single lab order error:', err);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Real-time Firestore listener for laboratory orders
   */
  subscribeToOrders(callback, viewer = null) {
    if (!db) {
      callback([]);
      return () => {};
    }

    let templatesMap = { ...DEFAULT_WORKFLOW_TEMPLATES };
    const unsubTemplates = this.subscribeWorkflowTemplates((m) => {
      templatesMap = m;
    });

    const ordersRef =
      viewer?.role === ROLES.LAB_TECH && viewer?.assignedVendor
        ? query(collection(db, 'labOrders'), where('vendor', '==', viewer.assignedVendor))
        : collection(db, 'labOrders');

    const unsubOrders = onSnapshot(
      ordersRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => {
          const order = normalizeRawDoc(d, templatesMap);
          if (canViewerAccessOrder(order, viewer)) {
            list.push(order);
          }
        });
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(list);
      },
      (err) => {
        console.error('Realtime lab orders listener error:', err);
      }
    );

    return () => {
      unsubTemplates();
      unsubOrders();
    };
  },

  /**
   * Phase 2.1 — Clinic Dentist submits a new laboratory request (Status: PENDING_REVIEW)
   */
  async create(data, actorInput = {}) {
    if (!db) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.DENTIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only authorized clinic dentists or administrators can submit laboratory requests.');
    }

    const cleanTeeth = Array.isArray(data.toothNumbers)
      ? data.toothNumbers.map((t) => String(t).trim()).filter(Boolean)
      : String(data.toothNumbers || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

    const inferred = inferCategoryAndWorkflow(data.applianceType, data.material);
    const category = data.category || inferred.category;
    const workflowId = data.workflowId || inferred.workflowId;
    const templatesMap = await this.getWorkflowTemplatesMap();
    const template = getWorkflowTemplate(workflowId, templatesMap);

    const inputType = data.inputType || 'DIGITAL_SCAN';
    const inputMeta = INPUT_SUBMISSION_TYPES.find((i) => i.value === inputType);
    const requiresPhysicalMaterials =
      data.requiresPhysicalMaterials !== undefined
        ? Boolean(data.requiresPhysicalMaterials)
        : Boolean(inputMeta?.requiresPhysicalArrival);

    const dueStr = data.estimatedCompletionDate || data.targetDeliveryDate || '';

    const initialTimeline = [
      makeTimelineEvent({
        step: 'SUBMITTED',
        status: LAB_ORDER_STATUS.PENDING_REVIEW,
        title: 'Prescription Submitted by Clinic',
        detail: `${data.applianceType} (${template.shortName}) requested by Dr. ${data.dentistName || actor.name}.`,
        actorName: data.dentistName || actor.name,
        actorRole: actor.role,
      }),
    ];

    const newOrder = {
      clinicName: data.clinicName || 'SmileGuard Dental Clinic',
      patientId: data.patientId || '',
      patientName: data.patientName || 'Patient',
      dentistId: data.dentistId || actor.uid || '',
      dentistName: data.dentistName || actor.name,
      applianceType: data.applianceType,
      category,
      workflowId,
      retainerSubtype: data.retainerSubtype || '',
      requiresTryIn:
        data.requiresTryIn !== undefined
          ? Boolean(data.requiresTryIn)
          : Boolean(template.supportsTryIn && category === 'DENTURES'),
      inputType,
      requiresPhysicalMaterials,
      material: data.material || 'Multilayer Zirconia',
      vendor: data.vendor || 'SmileGuard In-House Dental Lab',
      priority: data.priority || 'STANDARD',
      arch: data.arch || 'NOT_SPECIFIED',
      toothNumbers: cleanTeeth,
      shade: data.shade || 'A2',
      targetDeliveryDate: dueStr,
      estimatedCompletionDate: dueStr,
      status: LAB_ORDER_STATUS.PENDING_REVIEW,
      materialsStatus: requiresPhysicalMaterials
        ? MATERIALS_STATUS.AWAITING_MATERIALS
        : MATERIALS_STATUS.READY_FOR_PRODUCTION,
      productionStage: null,
      dispatchSubStatus: null,
      cost: data.cost || '',
      notes: data.notes || '',
      cadFileUrl: data.cadFileUrl || '',
      attachmentUrl: data.attachmentUrl || '',
      attachmentTitle: data.attachmentTitle || '',
      labAttachments: [],
      assignedTech: '',
      assignedTechId: '',
      labNotes: '',
      revisionReason: '',
      declineReason: '',
      tryInStatus: 'NONE',
      qcResult: null,
      qcHistory: [],
      dispatchDetails: null,
      clinicReceipt: null,
      issueReport: null,
      issueHistory: [],
      timeline: initialTimeline,
      communications: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'labOrders'), newOrder);

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'CREATED_LAB_REQUEST',
      resourceType: 'LAB_ORDER',
      resourceId: docRef.id,
      entity: `Submitted Lab Request #${docRef.id.slice(0, 6)}: ${newOrder.applianceType} (${newOrder.priority})`,
    });

    await notifyLabStaff(
      newOrder.priority === 'RUSH' ? '🚨 RUSH Laboratory Request' : '🧪 New Laboratory Request',
      `Dr. ${newOrder.dentistName} submitted ${newOrder.applianceType} (Due: ${dueStr || 'TBD'}).`,
      newOrder.vendor
    );

    return reconcileLabOrder({
      id: docRef.id,
      ...newOrder,
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Phase 2.1 & 2.2 — Laboratory accepts a request into Accepted (Awaiting Materials vs Ready for Production)
   */
  async acceptOrder(orderId, intakeDetails = {}, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.ACCEPTED,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const materialsAlreadyAvailable =
      intakeDetails.materialsAvailable !== undefined
        ? Boolean(intakeDetails.materialsAvailable)
        : !currentOrder.requiresPhysicalMaterials;

    const materialsStatus = materialsAlreadyAvailable
      ? MATERIALS_STATUS.READY_FOR_PRODUCTION
      : MATERIALS_STATUS.AWAITING_MATERIALS;

    const workflowId = intakeDetails.workflowId || currentOrder.workflowId;
    const estDate =
      intakeDetails.estimatedCompletionDate ||
      intakeDetails.targetDeliveryDate ||
      currentOrder.estimatedCompletionDate;

    const timelineEntry = makeTimelineEvent({
      step: 'ACCEPTED',
      status: LAB_ORDER_STATUS.ACCEPTED,
      title: `Request Accepted (${materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS ? 'Awaiting Physical Materials' : 'Ready for Production'})`,
      detail: intakeDetails.labNotes
        ? `Accepted by ${actor.name}. Note: ${intakeDetails.labNotes}`
        : `Accepted by ${actor.name}. Workflow: ${workflowId}.`,
      actorName: actor.name,
      actorRole: actor.role,
    });

    const timeline = [...(currentOrder.timeline || []), timelineEntry];
    if (materialsAlreadyAvailable) {
      timeline.push(
        makeTimelineEvent({
          step: 'MATERIALS_READY',
          status: LAB_ORDER_STATUS.ACCEPTED,
          title: 'Inputs Verified — Ready for Production',
          detail: 'Digital scan or required case inputs verified complete.',
          actorName: actor.name,
          actorRole: actor.role,
        })
      );
    }

    const updatePayload = {
      status: LAB_ORDER_STATUS.ACCEPTED,
      materialsStatus,
      workflowId,
      cost: intakeDetails.cost !== undefined ? intakeDetails.cost : currentOrder.cost || '',
      estimatedCompletionDate: estDate,
      targetDeliveryDate: estDate,
      assignedTech: intakeDetails.assignedTech ?? currentOrder.assignedTech ?? '',
      assignedTechId: intakeDetails.assignedTechId ?? currentOrder.assignedTechId ?? '',
      labNotes: intakeDetails.labNotes !== undefined ? intakeDetails.labNotes : currentOrder.labNotes || '',
      revisionReason: '',
      acceptedBy: actor.name,
      acceptedAt: serverTimestamp(),
      ...(materialsAlreadyAvailable ? { materialsReceivedAt: serverTimestamp(), materialsReceivedBy: actor.name } : {}),
      timeline,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'labOrders', orderId), updatePayload);

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_REQUEST_ACCEPTED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Accepted Lab Request ${currentOrder.requestCode} (${materialsStatus})`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      '✅ Laboratory Request Accepted',
      `${currentOrder.requestCode} (${currentOrder.applianceType}) was accepted by the laboratory (${
        materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS
          ? 'Awaiting Physical Impression/Model'
          : 'Ready for Production'
      }).`
    );

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.1 — Laboratory requests clarification from Clinic
   */
  async requestClarification(orderId, message, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    if (!String(message || '').trim()) {
      throw new Error('Clarification message is required.');
    }

    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const cleanMsg = message.trim();
    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'REVIEWED',
        status: LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
        title: 'Clarification Requested by Laboratory',
        detail: cleanMsg,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [
      ...(currentOrder.communications || []),
      makeCommunicationEntry({
        type: 'CLARIFICATION_REQUEST',
        message: cleanMsg,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
      revisionReason: cleanMsg,
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_CLARIFICATION_REQUESTED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Requested clarification on ${currentOrder.requestCode}: "${cleanMsg}"`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      '⚠️ Laboratory Clarification Requested',
      `${currentOrder.requestCode} (${currentOrder.applianceType}): "${cleanMsg}"`
    );

    return this.getById(orderId, actor);
  },

  /**
   * Alias for backward compatibility
   */
  async requestRevision(orderId, reason, actorInput = {}) {
    return this.requestClarification(orderId, reason, actorInput);
  },

  /**
   * Phase 2.1 — Clinic responds to clarification & resubmits prescription to Pending Review
   */
  async respondToClarification(orderId, updates = {}, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.PENDING_REVIEW,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const responseNote = String(updates.responseMessage || updates.notes || 'Updated prescription details provided.').trim();

    const cleanTeeth =
      updates.toothNumbers !== undefined
        ? Array.isArray(updates.toothNumbers)
          ? updates.toothNumbers.map((t) => String(t).trim()).filter(Boolean)
          : String(updates.toothNumbers || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : currentOrder.toothNumbers || [];

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'CLARIFICATION_PROVIDED',
        status: LAB_ORDER_STATUS.PENDING_REVIEW,
        title: 'Clinic Provided Clarification',
        detail: responseNote,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [
      ...(currentOrder.communications || []),
      makeCommunicationEntry({
        type: 'CLINIC_RESPONSE',
        message: responseNote,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const dueStr =
      updates.estimatedCompletionDate ??
      updates.targetDeliveryDate ??
      currentOrder.estimatedCompletionDate;

    await updateDoc(doc(db, 'labOrders', orderId), {
      applianceType: updates.applianceType ?? currentOrder.applianceType,
      material: updates.material ?? currentOrder.material,
      shade: updates.shade ?? currentOrder.shade,
      arch: updates.arch ?? currentOrder.arch ?? 'NOT_SPECIFIED',
      priority: updates.priority ?? currentOrder.priority,
      estimatedCompletionDate: dueStr,
      targetDeliveryDate: dueStr,
      notes: updates.notes ?? currentOrder.notes,
      cadFileUrl: updates.cadFileUrl ?? currentOrder.cadFileUrl,
      attachmentUrl: updates.attachmentUrl ?? currentOrder.attachmentUrl,
      attachmentTitle: updates.attachmentTitle ?? currentOrder.attachmentTitle,
      toothNumbers: cleanTeeth,
      status: LAB_ORDER_STATUS.PENDING_REVIEW,
      revisionReason: '',
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'CLINIC_RESUBMITTED_CLARIFICATION',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Clinic responded to clarification on ${currentOrder.requestCode}`,
    });

    await notifyLabStaff(
      '🔄 Clinic Responded to Clarification',
      `Dr. ${actor.name} updated ${currentOrder.requestCode} (${currentOrder.applianceType}) with requested details.`,
      currentOrder.vendor
    );

    return this.getById(orderId, actor);
  },

  async resubmitOrder(orderId, updates = {}, actorInput = {}) {
    return this.respondToClarification(orderId, updates, actorInput);
  },

  /**
   * Phase 2.1 — Laboratory declines a request (Reason strictly required)
   */
  async declineRequest(orderId, reason, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    if (!String(reason || '').trim()) {
      throw new Error('A documented clinical/operational reason is required to decline a laboratory request.');
    }

    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.DECLINED,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const cleanReason = reason.trim();
    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'DECLINED',
        status: LAB_ORDER_STATUS.DECLINED,
        title: 'Request Declined by Laboratory',
        detail: cleanReason,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.DECLINED,
      declineReason: cleanReason,
      declinedBy: actor.name,
      timeline,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_REQUEST_DECLINED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Declined ${currentOrder.requestCode}: "${cleanReason}"`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      '❌ Laboratory Request Declined',
      `${currentOrder.requestCode} (${currentOrder.applianceType}) was declined: "${cleanReason}"`
    );

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.2 — Laboratory confirms receipt of physical impression, stone cast, or repair item
   */
  async confirmMaterialsReceived(orderId, { receivedDate, conditionNote = '' } = {}, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only laboratory personnel can confirm physical material receipt.');
    }

    const currentOrder = await this.getById(orderId, actor);
    const effectiveDate = receivedDate || new Date().toISOString();

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'MATERIALS_READY',
        status: currentOrder.status,
        title: 'Physical Materials / Impression Received',
        detail: conditionNote
          ? `Confirmed by ${actor.name}: ${conditionNote}`
          : `Physical materials verified intact by ${actor.name}. Ready for Production.`,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      materialsStatus: MATERIALS_STATUS.READY_FOR_PRODUCTION,
      materialsReceivedAt: effectiveDate,
      materialsReceivedBy: actor.name,
      materialsConditionNote: conditionNote,
      timeline,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_MATERIALS_CONFIRMED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Confirmed material receipt for ${currentOrder.requestCode} — Ready for Production`,
    });

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.3 — Start Fabrication (Transitions ACCEPTED -> IN_PRODUCTION at Stage 1 of the service's workflow)
   */
  async startProduction(orderId, { assignedTech, assignedTechId = '', workflowId, estimatedCompletionDate, note = '' } = {}, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.IN_PRODUCTION,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const templatesMap = await this.getWorkflowTemplatesMap();
    const resolvedWorkflowId = workflowId || currentOrder.workflowId;
    const template = getWorkflowTemplate(resolvedWorkflowId, templatesMap);
    const firstStage = template.stages.find((s) => s.phase === 'PRODUCTION') || template.stages[0];

    const techName = assignedTech || currentOrder.assignedTech || actor.name;
    const nextDue = estimatedCompletionDate || currentOrder.estimatedCompletionDate;
    const dueChanged =
      Boolean(estimatedCompletionDate) &&
      estimatedCompletionDate !== currentOrder.estimatedCompletionDate;

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'IN_PRODUCTION',
        status: LAB_ORDER_STATUS.IN_PRODUCTION,
        title: `Production Started — ${firstStage.label}`,
        detail: `Workflow: ${template.shortName} • Technician: ${techName}${note ? ` • ${note}` : ''}`,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.IN_PRODUCTION,
      workflowId: resolvedWorkflowId,
      productionStage: firstStage.key,
      assignedTech: techName,
      assignedTechId,
      estimatedCompletionDate: nextDue,
      targetDeliveryDate: nextDue,
      productionStartedAt: serverTimestamp(),
      stageHistory: [
        ...(currentOrder.stageHistory || []),
        {
          stageKey: firstStage.key,
          stageLabel: firstStage.label,
          actorName: actor.name,
          timestamp: new Date().toISOString(),
          note,
        },
      ],
      timeline,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_PRODUCTION_STARTED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Started ${template.shortName} production on ${currentOrder.requestCode} (Tech: ${techName})`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      '⚙️ Appliance Production Started',
      `Fabrication has begun for ${currentOrder.requestCode} (${currentOrder.applianceType}) under ${template.shortName}.`
    );

    if (dueChanged) {
      await notifyDentist(
        currentOrder.dentistId,
        '📅 Estimated Completion Date Updated',
        `Expected completion for ${currentOrder.requestCode} (${currentOrder.applianceType}) is now ${nextDue}.`
      );
    }

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.3 & Phase 3 — Update Service-Specific Fabrication Stage or Enter Quality Check
   */
  async updateProductionStage(orderId, { stageKey, progressNote = '', sendForClinicTryIn = false }, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    if (![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only laboratory personnel can advance fabrication stages.');
    }

    const stages = currentOrder.workflowStages || [];
    const targetStageObj = stages.find((s) => s.key === stageKey);
    if (!targetStageObj) {
      throw new Error(`Stage "${stageKey}" does not belong to workflow "${currentOrder.workflowShortName}".`);
    }

    // Moving into Quality Check transitions the primary order status to QUALITY_CHECK
    if (targetStageObj.phase === 'QUALITY_CHECK' || stageKey === 'QUALITY_CHECK') {
      const check = validateWorkflowTransition({
        currentOrder,
        targetStatus: LAB_ORDER_STATUS.QUALITY_CHECK,
        userRole: actor.role,
      });
      if (!check.allowed) throw new Error(check.reason);

      const timeline = [
        ...(currentOrder.timeline || []),
        makeTimelineEvent({
          step: 'QUALITY_CHECK',
          status: LAB_ORDER_STATUS.QUALITY_CHECK,
          title: 'Entered Laboratory Quality Check',
          detail: progressNote || 'Fabrication steps complete — awaiting QA inspection.',
          actorName: actor.name,
          actorRole: actor.role,
        }),
      ];

      await updateDoc(doc(db, 'labOrders', orderId), {
        status: LAB_ORDER_STATUS.QUALITY_CHECK,
        productionStage: 'QUALITY_CHECK',
        stageHistory: [
          ...(currentOrder.stageHistory || []),
          {
            stageKey: 'QUALITY_CHECK',
            stageLabel: 'Quality Check',
            actorName: actor.name,
            timestamp: new Date().toISOString(),
            note: progressNote,
          },
        ],
        timeline,
        updatedAt: serverTimestamp(),
      });

      await activityLogService.log({
        userId: actor.uid,
        actor: `${actor.name} (${actor.role})`,
        action: 'LAB_ENTERED_QUALITY_CHECK',
        resourceType: 'LAB_ORDER',
        resourceId: orderId,
        entity: `${currentOrder.requestCode} moved to Laboratory Quality Check`,
      });

      return this.getById(orderId, actor);
    }

    if (targetStageObj.phase === 'DISPATCH' || stageKey === 'READY_FOR_DISPATCH') {
      throw new Error('Cannot skip Quality Check. Complete the Quality Check verification first.');
    }

    // Standard service-specific production stage update (including Denture Wax Try-In support)
    const tryInStatus = sendForClinicTryIn ? 'SENT_TO_CLINIC' : currentOrder.tryInStatus === 'SENT_TO_CLINIC' ? 'SENT_TO_CLINIC' : currentOrder.tryInStatus || 'NONE';

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'IN_PRODUCTION',
        status: LAB_ORDER_STATUS.IN_PRODUCTION,
        title: sendForClinicTryIn
          ? `Sent to Clinic for Wax Try-In / Approval`
          : `Fabrication Stage: ${targetStageObj.label}`,
        detail: progressNote || targetStageObj.desc || '',
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [...(currentOrder.communications || [])];
    if (progressNote || sendForClinicTryIn) {
      communications.push(
        makeCommunicationEntry({
          type: sendForClinicTryIn ? 'TRY_IN' : 'LAB_UPDATE',
          message: sendForClinicTryIn
            ? `Wax try-in dispatched to clinic for chairside evaluation. ${progressNote}`
            : `[${targetStageObj.label}] ${progressNote}`,
          actorName: actor.name,
          actorRole: actor.role,
        })
      );
    }

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.IN_PRODUCTION,
      productionStage: targetStageObj.key,
      tryInStatus,
      stageHistory: [
        ...(currentOrder.stageHistory || []),
        {
          stageKey: targetStageObj.key,
          stageLabel: targetStageObj.label,
          actorName: actor.name,
          timestamp: new Date().toISOString(),
          note: progressNote,
        },
      ],
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: sendForClinicTryIn ? 'LAB_SENT_TRY_IN' : 'LAB_STAGE_UPDATED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `${currentOrder.requestCode} stage -> ${targetStageObj.label}`,
    });

    if (sendForClinicTryIn) {
      await notifyDentist(
        currentOrder.dentistId,
        '🦷 Wax Try-In Sent for Clinic Approval',
        `${currentOrder.requestCode} (${currentOrder.applianceType}) requires chairside try-in approval before final processing.`
      );
    }

    return this.getById(orderId, actor);
  },

  /**
   * Phase 3 Workflow C — Clinic Dentist approves Wax Try-In (or requests setup adjustment) so Lab resumes production
   */
  async respondToClinicTryIn(orderId, { approved = true, dentistNotes = '' }, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.DENTIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only authorized clinic dentists can approve chairside try-in.');
    }

    const currentOrder = await this.getById(orderId, actor);
    const stages = currentOrder.workflowStages || [];
    const tryInIdx = stages.findIndex((s) => s.key === currentOrder.productionStage || s.isTryInStage);
    const nextProdStage =
      approved && tryInIdx !== -1 && stages[tryInIdx + 1]?.phase === 'PRODUCTION'
        ? stages[tryInIdx + 1]
        : stages.find((s) => s.key === 'WAX_UP_SETUP') || stages[0];

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'IN_PRODUCTION',
        status: LAB_ORDER_STATUS.IN_PRODUCTION,
        title: approved
          ? `Clinic Try-In Approved — Resuming (${nextProdStage.label})`
          : 'Clinic Try-In Returned for Wax-Up Adjustment',
        detail: dentistNotes || (approved ? 'Occlusion, VDO & esthetics approved for final processing.' : 'Reset requested.'),
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [
      ...(currentOrder.communications || []),
      makeCommunicationEntry({
        type: 'TRY_IN',
        message: approved
          ? `Try-In Approved by Dr. ${actor.name}: ${dentistNotes || 'Proceed to final processing and finishing.'}`
          : `Try-In Adjustment Requested by Dr. ${actor.name}: ${dentistNotes}`,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      tryInStatus: approved ? 'APPROVED' : 'ADJUSTMENT_NEEDED',
      productionStage: nextProdStage.key,
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: approved ? 'CLINIC_TRY_IN_APPROVED' : 'CLINIC_TRY_IN_ADJUSTMENT',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Clinic ${approved ? 'approved' : 'requested reset on'} try-in for ${currentOrder.requestCode}`,
    });

    await notifyLabStaff(
      approved ? '✅ Clinic Try-In Approved — Resume Fabrication' : '🔄 Try-In Adjustment Requested',
      `Dr. ${actor.name} reviewed ${currentOrder.requestCode} (${currentOrder.applianceType}): ${
        dentistNotes || (approved ? 'Approved for final processing.' : 'Adjustment needed.')
      }`,
      currentOrder.vendor
    );

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.3 & Phase 7 — Update Technician Assignment, Estimated Completion Date, or Lab Supporting Attachments
   */
  async updateProductionDetails(
    orderId,
    { assignedTech, assignedTechId, estimatedCompletionDate, newLabAttachment },
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Only laboratory personnel can modify production details.');
    }

    const currentOrder = await this.getById(orderId, actor);
    const updates = { updatedAt: serverTimestamp() };
    const timeline = [...(currentOrder.timeline || [])];

    if (assignedTech !== undefined && assignedTech !== currentOrder.assignedTech) {
      updates.assignedTech = assignedTech;
      if (assignedTechId !== undefined) updates.assignedTechId = assignedTechId;
      timeline.push(
        makeTimelineEvent({
          step: 'PRODUCTION_UPDATE',
          status: currentOrder.status,
          title: 'Technician Assignment Updated',
          detail: `Assigned to ${assignedTech || 'Unassigned'}`,
          actorName: actor.name,
          actorRole: actor.role,
        })
      );
    }

    const dateChanged =
      estimatedCompletionDate !== undefined &&
      estimatedCompletionDate !== currentOrder.estimatedCompletionDate;

    if (dateChanged) {
      updates.estimatedCompletionDate = estimatedCompletionDate;
      updates.targetDeliveryDate = estimatedCompletionDate;
      timeline.push(
        makeTimelineEvent({
          step: 'DUE_DATE_CHANGED',
          status: currentOrder.status,
          title: 'Estimated Completion Date Updated',
          detail: `Updated from ${currentOrder.estimatedCompletionDate || 'TBD'} to ${estimatedCompletionDate}`,
          actorName: actor.name,
          actorRole: actor.role,
        })
      );
    }

    if (newLabAttachment?.url) {
      updates.labAttachments = [
        ...(currentOrder.labAttachments || []),
        {
          id: `att_${Date.now()}`,
          url: newLabAttachment.url,
          title: newLabAttachment.title || 'Fabrication / QC Photo',
          uploadedBy: actor.name,
          uploadedAt: new Date().toISOString(),
        },
      ];
    }

    updates.timeline = timeline;
    await updateDoc(doc(db, 'labOrders', orderId), updates);

    if (dateChanged) {
      await notifyDentist(
        currentOrder.dentistId,
        '📅 Estimated Completion Date Changed',
        `Laboratory updated expected completion for ${currentOrder.requestCode} (${currentOrder.applianceType}) to ${estimatedCompletionDate}.`
      );
    }

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.4 & Scenario E — Submit Quality Check (Pass -> READY_FOR_DISPATCH, Fail -> Return to Fabrication Stage)
   */
  async submitQualityCheck(
    orderId,
    { passed, checklist = {}, notes = '', returnToStageKey = '' },
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const targetStatus = passed
      ? LAB_ORDER_STATUS.READY_FOR_DISPATCH
      : LAB_ORDER_STATUS.IN_PRODUCTION;

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    if (!passed && !String(notes || '').trim()) {
      throw new Error('A documented failure reason is required when returning an appliance from Quality Check.');
    }

    const stages = currentOrder.workflowStages || [];
    const prodStages = stages.filter((s) => s.phase === 'PRODUCTION');
    const fallbackReturnStage = prodStages[prodStages.length - 1] || stages[0];
    const resolvedReturnStage =
      stages.find((s) => s.key === returnToStageKey && s.phase === 'PRODUCTION') || fallbackReturnStage;

    const qcRecord = {
      id: `qc_${Date.now()}`,
      passed: Boolean(passed),
      checklist: {
        applianceVerified: Boolean(checklist.applianceVerified),
        materialVerified: Boolean(checklist.materialVerified),
        toothOrArchVerified: Boolean(checklist.toothOrArchVerified),
        workmanshipVerified: Boolean(checklist.workmanshipVerified),
        prescriptionMatched: Boolean(checklist.prescriptionMatched),
      },
      notes: String(notes || '').trim(),
      returnToStageKey: passed ? null : resolvedReturnStage.key,
      returnToStageLabel: passed ? null : resolvedReturnStage.label,
      checkedBy: actor.name,
      checkedAt: new Date().toISOString(),
    };

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'QUALITY_CHECK',
        status: targetStatus,
        title: passed
          ? 'Quality Check Passed — Ready for Pickup / Dispatch'
          : `Quality Check Failed — Returned to ${resolvedReturnStage.label}`,
        detail:
          qcRecord.notes ||
          'Appliance type, material, tooth/arch specs, and laboratory workmanship verified.',
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const updatePayload = {
      status: targetStatus,
      productionStage: passed ? 'READY_FOR_DISPATCH' : resolvedReturnStage.key,
      qcResult: qcRecord,
      qcHistory: [...(currentOrder.qcHistory || []), qcRecord],
      qcCompletedAt: serverTimestamp(),
      ...(passed
        ? {
            readyAt: serverTimestamp(),
            dispatchSubStatus: DISPATCH_SUB_STATUS.READY_FOR_PICKUP,
            dispatchDetails: {
              ...(currentOrder.dispatchDetails || {}),
              readyDate: new Date().toISOString(),
              subStatus: DISPATCH_SUB_STATUS.READY_FOR_PICKUP,
            },
          }
        : {}),
      timeline,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'labOrders', orderId), updatePayload);

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: passed ? 'LAB_QC_PASSED' : 'LAB_QC_FAILED_RETURNED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: passed
        ? `${currentOrder.requestCode} passed Quality Check — Ready for Pickup/Dispatch`
        : `${currentOrder.requestCode} failed QC -> ${resolvedReturnStage.label}: "${qcRecord.notes}"`,
    });

    if (passed) {
      await notifyDentist(
        currentOrder.dentistId,
        '✨ Quality Check Completed — Appliance Ready',
        `${currentOrder.requestCode} (${currentOrder.applianceType}) passed laboratory Quality Check and is Ready for Pickup / Dispatch.`
      );
    }

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.5 — Record Ready for Pickup / Dispatched / In Transit (NEVER auto-completes!)
   */
  async updateDispatchStatus(
    orderId,
    {
      subStatus = DISPATCH_SUB_STATUS.IN_TRANSIT,
      deliveryMethod = 'Clinic Messenger',
      readyDate,
      dispatchDate,
      courierReference = '',
      notes = '',
    },
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const isDispatched =
      subStatus === DISPATCH_SUB_STATUS.IN_TRANSIT ||
      subStatus === DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT;

    const targetStatus = isDispatched
      ? LAB_ORDER_STATUS.DISPATCHED
      : LAB_ORDER_STATUS.READY_FOR_DISPATCH;

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const nowIso = new Date().toISOString();
    const dispatchDetails = {
      subStatus,
      deliveryMethod,
      readyDate: readyDate || currentOrder.dispatchDetails?.readyDate || nowIso,
      dispatchDate: isDispatched ? dispatchDate || nowIso : '',
      courierReference: courierReference.trim(),
      notes: notes.trim(),
      recordedBy: actor.name,
      recordedAt: nowIso,
    };

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'READY_DISPATCHED',
        status: targetStatus,
        title: isDispatched
          ? `Appliance Dispatched (${deliveryMethod})`
          : `Appliance Ready for Pickup (${deliveryMethod})`,
        detail: `${courierReference ? `Ref: ${courierReference}. ` : ''}${notes || 'Awaiting physical receipt confirmation by clinic.'}`,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: targetStatus,
      productionStage: 'READY_FOR_DISPATCH',
      dispatchSubStatus: subStatus,
      dispatchDetails,
      ...(isDispatched ? { dispatchedAt: serverTimestamp() } : {}),
      timeline,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: isDispatched ? 'LAB_APPLIANCE_DISPATCHED' : 'LAB_APPLIANCE_READY_PICKUP',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `${currentOrder.requestCode} marked ${subStatus} via ${deliveryMethod}`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      isDispatched ? '📦 Appliance Dispatched to Clinic' : '📍 Appliance Ready for Clinic Pickup',
      `${currentOrder.requestCode} (${currentOrder.applianceType}) — ${deliveryMethod}${
        courierReference ? ` (Ref: ${courierReference})` : ''
      }. Please confirm receipt upon arrival.`
    );

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.6 — Authorized Clinic Personnel confirms physical receipt -> Marks request COMPLETED
   */
  async confirmClinicReceipt(
    orderId,
    { receivedBy, receivedAt, condition = 'Intact & Verified', remarks = '' } = {},
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.COMPLETED,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const receiverName = receivedBy || actor.name;
    const receiptTime = receivedAt || new Date().toISOString();

    const clinicReceipt = {
      receivedBy: receiverName,
      receivedByRole: actor.role,
      receivedAt: receiptTime,
      condition,
      remarks: remarks.trim(),
    };

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'RECEIVED_BY_CLINIC',
        status: LAB_ORDER_STATUS.COMPLETED,
        title: 'Received by Clinic — Request Completed',
        detail: `Received by ${receiverName} (${condition}).${remarks ? ` Remarks: ${remarks}` : ''}`,
        actorName: receiverName,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.COMPLETED,
      clinicReceipt,
      completedAt: serverTimestamp(),
      timeline,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${receiverName} (${actor.role})`,
      action: 'CLINIC_RECEIPT_CONFIRMED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Clinic confirmed physical receipt of ${currentOrder.requestCode} (${condition}) — Completed`,
    });

    await notifyLabStaff(
      '🦷 Clinic Receipt Confirmed — Case Completed',
      `${receiverName} confirmed physical receipt of ${currentOrder.requestCode} (${currentOrder.applianceType}) in "${condition}" condition.`,
      currentOrder.vendor
    );

    return this.getById(orderId, actor);
  },

  /**
   * Phase 2.6 & Scenario F — Clinic reports damage, missing items, or incorrect specifications on delivery
   */
  async reportClinicIssue(
    orderId,
    { issueType = 'Incorrect Specifications / Fit', description = '' },
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    if (!String(description || '').trim()) {
      throw new Error('Please describe the delivery damage, missing item, or specification discrepancy.');
    }

    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus: LAB_ORDER_STATUS.ISSUE_REPORTED,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const issue = {
      id: `iss_${Date.now()}`,
      issueType,
      description: description.trim(),
      reportedBy: actor.name,
      reportedAt: new Date().toISOString(),
      status: 'OPEN',
    };

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'ISSUE_REPORTED',
        status: LAB_ORDER_STATUS.ISSUE_REPORTED,
        title: `Clinic Delivery Issue: ${issueType}`,
        detail: issue.description,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [
      ...(currentOrder.communications || []),
      makeCommunicationEntry({
        type: 'ISSUE_REPORT',
        message: `[${issueType}] ${issue.description}`,
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: LAB_ORDER_STATUS.ISSUE_REPORTED,
      issueReport: issue,
      issueHistory: [...(currentOrder.issueHistory || []), issue],
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'CLINIC_REPORTED_LAB_ISSUE',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Issue raised on ${currentOrder.requestCode} (${issueType}): "${issue.description}"`,
    });

    await notifyLabStaff(
      '🚨 Clinic Reported Delivery / Specification Issue',
      `Dr. ${actor.name} reported "${issueType}" on ${currentOrder.requestCode} (${currentOrder.applianceType}).`,
      currentOrder.vendor
    );

    return this.getById(orderId, actor);
  },

  /**
   * Scenario F — Laboratory resolves a reported clinic issue (Return to Fabrication Remake OR Re-dispatch Corrected Item)
   */
  async resolveReportedIssue(
    orderId,
    { action = 'RETURN_TO_PRODUCTION', targetStageKey = '', resolutionNotes = '', courierReference = '' },
    actorInput = {}
  ) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    if (!String(resolutionNotes || '').trim()) {
      throw new Error('Please document how the reported issue is being resolved.');
    }

    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const targetStatus =
      action === 'REDISPATCH'
        ? LAB_ORDER_STATUS.DISPATCHED
        : LAB_ORDER_STATUS.IN_PRODUCTION;

    const check = validateWorkflowTransition({
      currentOrder,
      targetStatus,
      userRole: actor.role,
    });
    if (!check.allowed) throw new Error(check.reason);

    const stages = currentOrder.workflowStages || [];
    const prodStages = stages.filter((s) => s.phase === 'PRODUCTION');
    const resolvedStage =
      stages.find((s) => s.key === targetStageKey && s.phase === 'PRODUCTION') || prodStages[0];

    const resolvedIssue = {
      ...(currentOrder.issueReport || {}),
      status: 'RESOLVED_BY_LAB',
      resolutionAction: action,
      resolutionNotes: resolutionNotes.trim(),
      resolvedBy: actor.name,
      resolvedAt: new Date().toISOString(),
    };

    const timeline = [
      ...(currentOrder.timeline || []),
      makeTimelineEvent({
        step: 'ISSUE_RESOLUTION',
        status: targetStatus,
        title:
          action === 'REDISPATCH'
            ? 'Issue Resolved — Replacement / Corrected Item Dispatched'
            : `Issue Acknowledged — Returned to ${resolvedStage.label}`,
        detail: resolutionNotes.trim(),
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    const communications = [
      ...(currentOrder.communications || []),
      makeCommunicationEntry({
        type: 'ISSUE_RESOLUTION',
        message: resolutionNotes.trim(),
        actorName: actor.name,
        actorRole: actor.role,
      }),
    ];

    await updateDoc(doc(db, 'labOrders', orderId), {
      status: targetStatus,
      productionStage: action === 'REDISPATCH' ? 'READY_FOR_DISPATCH' : resolvedStage.key,
      ...(action === 'REDISPATCH'
        ? {
            dispatchSubStatus: DISPATCH_SUB_STATUS.IN_TRANSIT,
            dispatchDetails: {
              ...(currentOrder.dispatchDetails || {}),
              subStatus: DISPATCH_SUB_STATUS.IN_TRANSIT,
              dispatchDate: new Date().toISOString(),
              courierReference: courierReference || currentOrder.dispatchDetails?.courierReference || '',
              notes: resolutionNotes.trim(),
              recordedBy: actor.name,
            },
          }
        : {}),
      issueReport: resolvedIssue,
      timeline,
      communications,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actor.uid,
      actor: `${actor.name} (${actor.role})`,
      action: 'LAB_ISSUE_RESOLVED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Resolved issue on ${currentOrder.requestCode} (${action}): "${resolutionNotes.trim()}"`,
    });

    await notifyDentist(
      currentOrder.dentistId,
      '🔧 Laboratory Issue Resolution Update',
      `${currentOrder.requestCode} (${currentOrder.applianceType}): ${resolutionNotes.trim()}`
    );

    return this.getById(orderId, actor);
  },

  /**
   * Shared Clinic <-> Laboratory Communication Log Entry
   */
  async addCommunication(orderId, { message, type = 'LAB_UPDATE' }, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    if (!String(message || '').trim()) return null;

    const actor = await resolveActorContext(actorInput);
    const currentOrder = await this.getById(orderId, actor);

    const entry = makeCommunicationEntry({
      type: actor.role === ROLES.DENTIST ? 'CLINIC_RESPONSE' : type,
      message: message.trim(),
      actorName: actor.name,
      actorRole: actor.role,
    });

    await updateDoc(doc(db, 'labOrders', orderId), {
      communications: [...(currentOrder.communications || []), entry],
      updatedAt: serverTimestamp(),
    });

    if (actor.role === ROLES.DENTIST) {
      await notifyLabStaff(
        `💬 Clinic Note on ${currentOrder.requestCode}`,
        `Dr. ${actor.name}: "${message.trim()}"`,
        currentOrder.vendor
      );
    } else {
      await notifyDentist(
        currentOrder.dentistId,
        `💬 Laboratory Update on ${currentOrder.requestCode}`,
        `${actor.name}: "${message.trim()}"`
      );
    }

    return entry;
  },

  /**
   * Internal Laboratory Technician Bench Notes (Subcollection isolated from Clinic & Patients!)
   */
  subscribeInternalNotes(orderId, viewerRole, callback) {
    if (!db || !orderId || ![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(viewerRole)) {
      callback([]);
      return () => {};
    }

    return onSnapshot(
      collection(db, 'labOrders', orderId, 'internalNotes'),
      (snap) => {
        const notes = [];
        snap.forEach((d) => {
          const data = d.data();
          notes.push({
            id: d.id,
            ...data,
            createdAt: toIsoDate(data.createdAt, new Date().toISOString()),
          });
        });
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(notes);
      },
      () => callback([])
    );
  },

  async addInternalNote(orderId, noteText, actorInput = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');
    const actor = await resolveActorContext(actorInput);
    if (![ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(actor.role)) {
      throw new Error('Unauthorized: Internal production notes are restricted to laboratory personnel.');
    }
    if (!String(noteText || '').trim()) return null;

    const payload = {
      note: noteText.trim(),
      message: noteText.trim(),
      authorName: actor.name,
      authorRole: actor.role,
      authorUid: actor.uid,
      createdAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, 'labOrders', orderId, 'internalNotes'), payload);
    return { id: ref.id, ...payload, createdAt: new Date().toISOString() };
  },
};
