import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

/**
 * Service for clinical dental and orthodontic treatment plans in Cloud Firestore
 */
export const treatmentService = {
  /**
   * Retrieves all treatment plans
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'treatmentPlans'));
      const list = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      return list;
    } catch (err) {
      console.error('Error fetching treatment plans from Firestore:', err);
      throw err;
    }
  },

  /**
   * Retrieves treatment plan for a specific patient
   * @param {string} patientId
   * @returns {Promise<Object|null>}
   */
  async getByPatientId(patientId) {
    if (!db || !patientId) return null;
    try {
      const q = query(collection(db, 'treatmentPlans'), where('patientId', '==', patientId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const firstDoc = snapshot.docs[0];
      return { id: firstDoc.id, ...firstDoc.data() };
    } catch (err) {
      console.error('Error fetching patient treatment plan:', err);
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

    const newRecord = {
      ...planData,
      progressPercentage: planData.progressPercentage || 0,
      status: planData.status || 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'treatmentPlans'), newRecord);

    await activityLogService.log({
      action: 'TREATMENT_PLAN_CREATED',
      resourceType: 'TREATMENT_PLAN',
      resourceId: docRef.id,
      entity: `Created plan: ${planData.type || 'Treatment'} for patient ${planData.patientId}`,
    });

    return { id: docRef.id, ...newRecord };
  },

  /**
   * Updates stage, progress percentage, next adjustment date and clinical notes
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

    const updatePayload = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    // Notify patient of treatment stage changes
    if (current.patientId) {
      await notificationService.create({
        userId: current.patientId,
        title: 'Treatment Plan Updated',
        message: `${dentistName} updated your clinical treatment progression (${updates.progressPercentage || current.progressPercentage}%).`,
        type: 'TREATMENT',
      });
    }

    await activityLogService.log({
      actor: dentistName,
      action: 'TREATMENT_PLAN_UPDATED',
      resourceType: 'TREATMENT_PLAN',
      resourceId: treatmentId,
      entity: `Updated progress for treatment #${treatmentId}`,
    });

    return { id: treatmentId, ...current, ...updatePayload };
  },
};
