import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

/**
 * Procedural default milestone templates by dental procedure category
 */
export function generateDefaultStages(treatmentType = '', totalStages = 4, currentStageNumber = 1, startDate = '') {
  const count = Math.max(1, Math.min(10, Number(totalStages) || 4));
  const normalizedType = treatmentType.toLowerCase();

  let stageNames = [];

  if (normalizedType.includes('brace') || normalizedType.includes('ortho')) {
    stageNames = [
      'Phase 1: Diagnostic Assessment & Initial Bracket Bonding (Leveling & Alignment)',
      'Phase 2: Active Canine Retraction & Intermaxillary Space Closure',
      'Phase 3: Bite Finishing, Artistic Detailing & Occlusal Interdigitation',
      'Phase 4: Debonding, Enamel Polish & Fixed / Removable Retainer Delivery',
      'Phase 5: Retention Stability Monitoring (6-Month Follow-Up)',
      'Phase 6: Long-Term Occlusal Stabilization (12-Month Follow-Up)',
    ];
  } else if (normalizedType.includes('align') || normalizedType.includes('invisalign')) {
    stageNames = [
      'Phase 1: 3D Intraoral Scanning, Composite Attachment Bonding & Tray Set 1',
      'Phase 2: Active Rotational Realignment & Interproximal Reduction (IPR)',
      'Phase 3: Clinical Tracking Review & Refinement Aligner Fabrication',
      'Phase 4: Final Occlusal Settling & Vivera Retainer Protocol',
    ];
  } else if (normalizedType.includes('denture') || normalizedType.includes('partial') || normalizedType.includes('prostho')) {
    stageNames = [
      'Phase 1: Preliminary Diagnostic Alginate Impressions & Study Models',
      'Phase 2: Custom Tray Border Molding & Secondary Elastomeric Master Cast',
      'Phase 3: Centric Jaw Relation, Vertical Dimension & Wax Teeth Try-in',
      'Phase 4: Final Denture Processing, Insertion & Occlusal Equilibration',
      'Phase 5: Post-Insertion Relief & Pressure Point Adjustment',
    ];
  } else if (normalizedType.includes('crown') || normalizedType.includes('bridge') || normalizedType.includes('restor')) {
    stageNames = [
      'Phase 1: Tooth Preparation, Biological Margin Sculpting & Digital Impression',
      'Phase 2: Provisional Acrylic Temporary Restoration & Margin Gingival Healing',
      'Phase 3: Lab Substructure / Zirconia Coping Try-in & Precise Shade Matching',
      'Phase 4: Permanent Resin Cementation, Contact Inspection & Final High-Gloss Polish',
    ];
  } else if (normalizedType.includes('root canal') || normalizedType.includes('endo')) {
    stageNames = [
      'Phase 1: Coronal Access Opening, Pulp Extirpation & Working Length Verification',
      'Phase 2: Rotary Chemo-mechanical Canal Shaping & Biocompatible Irrigant Disinfection',
      'Phase 3: 3D Warm Gutta-Percha Obturation & Radiographic Apex Sealing Verification',
      'Phase 4: Post-Endodontic Fiber Post Placement & Core Foundation Buildup',
    ];
  } else if (normalizedType.includes('extract') || normalizedType.includes('surg')) {
    stageNames = [
      'Phase 1: Pre-op Periapical Radiograph, Anesthesia & Surgical Access',
      'Phase 2: Atraumatic Extraction, Granulation Curettage & Socket Preservation',
      'Phase 3: Hemostatic Sponge Placement & Resorbable Suture Stabilization',
      'Phase 4: Post-op Wound Healing Evaluation & Suture Removal Review',
    ];
  } else {
    stageNames = [
      'Phase 1: Comprehensive Clinical Examination & Initial Phase Therapy',
      'Phase 2: Active Treatment Intervention & Therapeutic Procedure',
      'Phase 3: Healing Progress Assessment, Refinement & Verification',
      'Phase 4: Final Clinical Evaluation & Preventive Long-Term Maintenance',
    ];
  }

  const stages = [];
  const startYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();

  for (let i = 1; i <= count; i++) {
    const name = stageNames[i - 1] || `Phase ${i}: Active Clinical Progression Stage`;
    let status = 'PENDING';
    if (i < currentStageNumber) {
      status = 'COMPLETED';
    } else if (i === currentStageNumber) {
      status = 'IN_PROGRESS';
    }

    stages.push({
      number: i,
      name,
      date: `Phase ${i} (${startYear})`,
      status,
    });
  }

  return stages;
}

/**
 * Service for clinical dental and orthodontic treatment plans in Cloud Firestore
 */
export const treatmentService = {
  /**
   * Retrieves all treatment plans with stages initialized
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'treatmentPlans'));
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const stageNumber = Number(data.stageNumber) || 1;
        const totalStages = Number(data.totalStages) || 4;
        const stages = (data.stages && data.stages.length > 0)
          ? data.stages
          : generateDefaultStages(data.treatmentType || data.type, totalStages, stageNumber, data.startDate);

        list.push({
          id: d.id,
          ...data,
          stageNumber,
          totalStages,
          stages,
          progressPercentage: Number(data.progressPercentage) || 0,
          stage: data.stage || 'INITIAL',
        });
      });

      // Sort newest / active first
      return list.sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
    } catch (err) {
      console.error('Error fetching treatment plans from Firestore:', err);
      throw err;
    }
  },

  /**
   * Retrieves active treatment plan for a specific patient
   * @param {string} patientId
   * @returns {Promise<Object|null>}
   */
  async getByPatientId(patientId) {
    if (!db || !patientId) return null;
    try {
      const q = query(collection(db, 'treatmentPlans'), where('patientId', '==', patientId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const plans = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const stageNumber = Number(data.stageNumber) || 1;
        const totalStages = Number(data.totalStages) || 4;
        const stages = (data.stages && data.stages.length > 0)
          ? data.stages
          : generateDefaultStages(data.treatmentType || data.type, totalStages, stageNumber, data.startDate);

        plans.push({
          id: d.id,
          ...data,
          stageNumber,
          totalStages,
          stages,
          progressPercentage: Number(data.progressPercentage) || 0,
          stage: data.stage || 'INITIAL',
        });
      });

      // Prioritize active plan first, otherwise the most recently updated
      const active = plans.find((p) => p.status === 'ACTIVE') || plans[0];
      return active || null;
    } catch (err) {
      console.error('Error fetching patient treatment plan:', err);
      return null;
    }
  },

  /**
   * Retrieves single treatment plan by ID
   * @param {string} treatmentId
   * @returns {Promise<Object|null>}
   */
  async getById(treatmentId) {
    if (!db || !treatmentId) return null;
    try {
      const docRef = doc(db, 'treatmentPlans', treatmentId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      const stageNumber = Number(data.stageNumber) || 1;
      const totalStages = Number(data.totalStages) || 4;
      const stages = (data.stages && data.stages.length > 0)
        ? data.stages
        : generateDefaultStages(data.treatmentType || data.type, totalStages, stageNumber, data.startDate);

      return {
        id: snap.id,
        ...data,
        stageNumber,
        totalStages,
        stages,
        progressPercentage: Number(data.progressPercentage) || 0,
        stage: data.stage || 'INITIAL',
      };
    } catch (err) {
      console.error('Error fetching treatment plan by ID:', err);
      return null;
    }
  },

  /**
   * Creates a new treatment plan for a patient in Firestore
   * @param {Object} planData
   * @returns {Promise<Object>}
   */
  async create(planData) {
    if (!db) throw new Error('Firestore is not initialized.');

    const totalStages = Number(planData.totalStages) || 4;
    const stageNumber = Number(planData.stageNumber) || 1;
    const stages = (planData.stages && planData.stages.length > 0)
      ? planData.stages
      : generateDefaultStages(planData.treatmentType || planData.type, totalStages, stageNumber, planData.startDate);

    const newRecord = {
      patientId: planData.patientId,
      patientName: planData.patientName,
      dentistId: planData.dentistId || '',
      dentistName: planData.dentistName || 'Attending Dentist',
      treatmentType: planData.treatmentType || 'Orthodontic Braces Alignment',
      stage: planData.stage || 'INITIAL',
      stageNumber,
      totalStages,
      stages,
      progressPercentage: Number(planData.progressPercentage) || 0,
      startDate: planData.startDate || new Date().toISOString().split('T')[0],
      nextAdjustmentDate: planData.nextAdjustmentDate || '',
      estimatedCompletionDate: planData.estimatedCompletionDate || '',
      dentistNotes: planData.dentistNotes || '',
      status: planData.status || 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'treatmentPlans'), newRecord);

    // Notify patient of new active treatment plan
    if (newRecord.patientId) {
      try {
        await notificationService.create({
          userId: newRecord.patientId,
          title: 'Treatment Plan Initialized',
          message: `Dr. ${newRecord.dentistName} has initialized your ${newRecord.treatmentType} roadmap with ${totalStages} clinical milestones.`,
          type: 'TREATMENT',
        });
      } catch (notifErr) {
        console.warn('Could not dispatch initial treatment notification:', notifErr);
      }
    }

    await activityLogService.log({
      action: 'TREATMENT_PLAN_CREATED',
      resourceType: 'TREATMENT_PLAN',
      resourceId: docRef.id,
      entity: `Created plan: ${newRecord.treatmentType} for patient ${newRecord.patientName} (${newRecord.patientId})`,
    });

    return { id: docRef.id, ...newRecord };
  },

  /**
   * Updates stage, progress percentage, next adjustment date, notes and stages array
   * @param {string} treatmentId
   * @param {Object} updates
   * @param {string} dentistName
   * @returns {Promise<Object>}
   */
  async update(treatmentId, updates, dentistName = 'Attending Dentist') {
    if (!db || !treatmentId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'treatmentPlans', treatmentId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Treatment plan not found');

    const current = existingSnap.data();

    const targetStageNum = updates.stageNumber !== undefined
      ? Number(updates.stageNumber)
      : (Number(current.stageNumber) || 1);

    const targetTotal = updates.totalStages !== undefined
      ? Number(updates.totalStages)
      : (Number(current.totalStages) || 4);

    // Synchronize stages statuses
    let updatedStages = updates.stages;
    if (!updatedStages) {
      const baseStages = (current.stages && current.stages.length > 0)
        ? current.stages
        : generateDefaultStages(current.treatmentType, targetTotal, targetStageNum, current.startDate);

      updatedStages = baseStages.map((s, idx) => {
        const num = s.number || (idx + 1);
        let status = 'PENDING';
        if (num < targetStageNum) status = 'COMPLETED';
        else if (num === targetStageNum) status = 'IN_PROGRESS';
        return { ...s, status };
      });
    }

    const updatePayload = {
      ...updates,
      stageNumber: targetStageNum,
      totalStages: targetTotal,
      stages: updatedStages,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    // Notify patient of treatment stage changes
    if (current.patientId) {
      try {
        const pct = updates.progressPercentage !== undefined ? updates.progressPercentage : current.progressPercentage;
        await notificationService.create({
          userId: current.patientId,
          title: 'Treatment Plan Updated',
          message: `${dentistName} updated your clinical treatment progression (Stage ${targetStageNum} of ${targetTotal} - ${pct}% complete).`,
          type: 'TREATMENT',
        });
      } catch (notifErr) {
        console.warn('Could not dispatch update treatment notification:', notifErr);
      }
    }

    await activityLogService.log({
      actor: dentistName,
      action: 'TREATMENT_PLAN_UPDATED',
      resourceType: 'TREATMENT_PLAN',
      resourceId: treatmentId,
      entity: `Updated progress for treatment #${treatmentId} (${updates.progressPercentage || current.progressPercentage}%)`,
    });

    return { id: treatmentId, ...current, ...updatePayload };
  },

  /**
   * Deletes a treatment plan
   * @param {string} treatmentId
   * @param {string} actorName
   * @returns {Promise<boolean>}
   */
  async delete(treatmentId, actorName = 'Staff') {
    if (!db || !treatmentId) throw new Error('Firestore is not initialized.');
    const docRef = doc(db, 'treatmentPlans', treatmentId);
    await deleteDoc(docRef);

    await activityLogService.log({
      actor: actorName,
      action: 'TREATMENT_PLAN_DELETED',
      resourceType: 'TREATMENT_PLAN',
      resourceId: treatmentId,
      entity: `Deleted treatment plan #${treatmentId}`,
    });

    return true;
  },
};
