import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LAB_ORDER_STATUS } from '../lib/constants';
import { ROLES } from '../lib/roles';
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

function normalizeOrderDoc(d) {
  const data = d.data();
  const nowIso = new Date().toISOString();
  return {
    id: d.id,
    ...data,
    createdAt: toIsoDate(data.createdAt, nowIso),
    updatedAt: toIsoDate(data.updatedAt, null),
    receivedAt: toIsoDate(data.receivedAt, null),
    dispatchedAt: toIsoDate(data.dispatchedAt, null),
    completedAt: toIsoDate(data.completedAt, null),
  };
}

async function notifyLabStaff(title, message) {
  if (!db) return;
  try {
    const q = query(collection(db, 'users'), where('role', '==', ROLES.LAB_TECH));
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach((userDoc) => {
      const u = userDoc.data();
      if (!u.deactivated) {
        promises.push(
          notificationService.create({
            userId: userDoc.id,
            title,
            message,
            type: 'LAB_ORDER',
          })
        );
      }
    });
    await Promise.allSettled(promises);
  } catch (err) {
    console.warn('Non-critical lab staff notification warning:', err);
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

/**
 * Service for dental appliance laboratory orders in Cloud Firestore
 * End-to-End Workflow:
 * Dentist Order (PENDING_REVIEW) -> Lab Intake (RECEIVED / REVISION_NEEDED)
 * -> DESIGN -> MILLING -> GLAZING -> QA -> DISPATCHED -> Clinic Fitted (COMPLETED)
 */
export const laboratoryService = {
  /**
   * Retrieves all laboratory orders once
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'labOrders'));
      const list = [];
      snapshot.forEach((d) => {
        list.push(normalizeOrderDoc(d));
      });
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('Error fetching lab orders from Firestore:', err);
      throw err;
    }
  },

  /**
   * Real-time Firestore listener for laboratory orders across Dentist & Lab portals
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToOrders(callback) {
    if (!db) {
      callback([]);
      return () => {};
    }

    return onSnapshot(
      collection(db, 'labOrders'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => {
          list.push(normalizeOrderDoc(d));
        });
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(list);
      },
      (err) => {
        console.error('Realtime lab orders listener error:', err);
      }
    );
  },

  /**
   * Dentist dispatches a new digital lab prescription to the Laboratory
   * @param {Object} data
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async create(data, actorName = 'Dentist') {
    if (!db) throw new Error('Firestore is not initialized.');

    const cleanTeeth = Array.isArray(data.toothNumbers)
      ? data.toothNumbers.map((t) => String(t).trim()).filter(Boolean)
      : String(data.toothNumbers || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

    const newOrder = {
      patientId: data.patientId || '',
      patientName: data.patientName || 'Patient',
      dentistId: data.dentistId || '',
      dentistName: data.dentistName || actorName,
      applianceType: data.applianceType,
      material: data.material || 'Multilayer Zirconia',
      vendor: data.vendor || 'SmileGuard In-House CAD/CAM Lab',
      priority: data.priority || 'STANDARD',
      toothNumbers: cleanTeeth,
      shade: data.shade || 'A2',
      targetDeliveryDate: data.targetDeliveryDate || '',
      status: LAB_ORDER_STATUS.PENDING_REVIEW,
      cost: data.cost || '₱3,500',
      notes: data.notes || '',
      cadFileUrl: data.cadFileUrl || '',
      attachmentUrl: data.attachmentUrl || '',
      attachmentTitle: data.attachmentTitle || '',
      assignedTech: '',
      labNotes: '',
      revisionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'labOrders'), newOrder);

    await activityLogService.log({
      actor: actorName,
      action: 'CREATED_LAB_ORDER',
      resourceType: 'LAB_ORDER',
      resourceId: docRef.id,
      entity: `Dispatched Lab Rx: ${newOrder.applianceType} for ${newOrder.patientName} (${newOrder.priority})`,
    });

    await notifyLabStaff(
      newOrder.priority === 'RUSH' ? '🚨 RUSH Lab Prescription Received' : '🧪 New Dentist Lab Order',
      `Dr. ${newOrder.dentistName} ordered ${newOrder.applianceType} for ${newOrder.patientName} (Due: ${newOrder.targetDeliveryDate || 'TBD'}).`
    );

    return {
      id: docRef.id,
      ...newOrder,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Laboratory Admin accepts an incoming Dentist prescription into active CAD/CAM production
   * @param {string} orderId
   * @param {Object} intakeDetails
   * @param {string} actorName
   */
  async acceptOrder(orderId, intakeDetails = {}, actorName = 'Laboratory Admin') {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'labOrders', orderId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Lab order not found');

    const existing = existingSnap.data();
    const updatePayload = {
      status: LAB_ORDER_STATUS.RECEIVED,
      cost: intakeDetails.cost !== undefined ? intakeDetails.cost : existing.cost,
      targetDeliveryDate:
        intakeDetails.targetDeliveryDate !== undefined
          ? intakeDetails.targetDeliveryDate
          : existing.targetDeliveryDate,
      assignedTech: intakeDetails.assignedTech || existing.assignedTech || actorName,
      labNotes: intakeDetails.labNotes !== undefined ? intakeDetails.labNotes : existing.labNotes || '',
      revisionReason: '',
      receivedBy: actorName,
      receivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    await activityLogService.log({
      actor: actorName,
      action: 'ACCEPTED_LAB_ORDER',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Laboratory accepted Rx #${orderId.slice(0, 6)} (${existing.applianceType} for ${existing.patientName})`,
    });

    await notifyDentist(
      existing.dentistId,
      '✅ Lab Order Accepted into Production',
      `Laboratory accepted ${existing.applianceType} for ${existing.patientName} (Fee: ${updatePayload.cost || 'TBD'}, Target: ${updatePayload.targetDeliveryDate || 'Scheduled'}).`
    );

    return { id: orderId, ...existing, ...updatePayload };
  },

  /**
   * Laboratory Admin returns a prescription to the Dentist requesting clarification or a new scan
   * @param {string} orderId
   * @param {string} reason
   * @param {string} actorName
   */
  async requestRevision(orderId, reason, actorName = 'Laboratory Admin') {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'labOrders', orderId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Lab order not found');

    const existing = existingSnap.data();
    const updatePayload = {
      status: LAB_ORDER_STATUS.REVISION_NEEDED,
      revisionReason: reason || 'Clarification or updated scan requested by Laboratory.',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    await activityLogService.log({
      actor: actorName,
      action: 'LAB_ORDER_REVISION_REQUESTED',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Returned Rx #${orderId.slice(0, 6)} to Dentist: ${updatePayload.revisionReason}`,
    });

    await notifyDentist(
      existing.dentistId,
      '⚠️ Lab Order Needs Clinical Revision',
      `Laboratory returned ${existing.applianceType} (${existing.patientName}): "${updatePayload.revisionReason}"`
    );

    return { id: orderId, ...existing, ...updatePayload };
  },

  /**
   * Dentist updates & resubmits a returned prescription back to Laboratory intake
   * @param {string} orderId
   * @param {Object} updates
   * @param {string} actorName
   */
  async resubmitOrder(orderId, updates = {}, actorName = 'Dentist') {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'labOrders', orderId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Lab order not found');

    const existing = existingSnap.data();
    const cleanTeeth =
      updates.toothNumbers !== undefined
        ? Array.isArray(updates.toothNumbers)
          ? updates.toothNumbers.map((t) => String(t).trim()).filter(Boolean)
          : String(updates.toothNumbers || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : existing.toothNumbers || [];

    const updatePayload = {
      applianceType: updates.applianceType ?? existing.applianceType,
      material: updates.material ?? existing.material,
      shade: updates.shade ?? existing.shade,
      priority: updates.priority ?? existing.priority,
      targetDeliveryDate: updates.targetDeliveryDate ?? existing.targetDeliveryDate,
      notes: updates.notes ?? existing.notes,
      cadFileUrl: updates.cadFileUrl ?? existing.cadFileUrl,
      attachmentUrl: updates.attachmentUrl ?? existing.attachmentUrl,
      attachmentTitle: updates.attachmentTitle ?? existing.attachmentTitle,
      toothNumbers: cleanTeeth,
      status: LAB_ORDER_STATUS.PENDING_REVIEW,
      revisionReason: '',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    await activityLogService.log({
      actor: actorName,
      action: 'RESUBMITTED_LAB_ORDER',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Dentist resubmitted revised Rx #${orderId.slice(0, 6)} (${updatePayload.applianceType})`,
    });

    await notifyLabStaff(
      '🔄 Revised Lab Prescription Resubmitted',
      `Dr. ${existing.dentistName || actorName} updated & resubmitted ${updatePayload.applianceType} for ${existing.patientName}.`
    );

    return { id: orderId, ...existing, ...updatePayload };
  },

  /**
   * Updates production status of a lab order in Firestore
   * @param {string} orderId
   * @param {string} status - RECEIVED, DESIGN, MILLING, GLAZING, QA, DISPATCHED, COMPLETED
   * @param {string} actorName
   * @param {Object} [extraUpdates]
   * @returns {Promise<Object>}
   */
  async updateStatus(orderId, status, actorName = 'Laboratory Admin', extraUpdates = {}) {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'labOrders', orderId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Lab order not found');

    const existing = existingSnap.data();
    const updatePayload = {
      ...extraUpdates,
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === LAB_ORDER_STATUS.DISPATCHED) {
      updatePayload.dispatchedAt = serverTimestamp();
    }
    if (status === LAB_ORDER_STATUS.COMPLETED) {
      updatePayload.completedAt = serverTimestamp();
    }

    await updateDoc(docRef, updatePayload);

    await activityLogService.log({
      actor: actorName,
      action: 'UPDATED_LAB_ORDER_STATUS',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Lab Order #${orderId.slice(0, 6)} (${existing.applianceType}) marked as ${status}`,
    });

    if (status === LAB_ORDER_STATUS.DISPATCHED) {
      await notifyDentist(
        existing.dentistId,
        '📦 Lab Appliance Dispatched to Clinic!',
        `${existing.applianceType} for ${existing.patientName} passed QA and has been dispatched for chairside fitting.`
      );
    } else if (status === LAB_ORDER_STATUS.COMPLETED) {
      await notifyLabStaff(
        '🦷 Appliance Fitted & Case Completed',
        `Dr. ${actorName} confirmed receipt & patient fitting for ${existing.applianceType} (${existing.patientName}).`
      );
    }

    return { id: orderId, ...existing, ...updatePayload };
  },
};
