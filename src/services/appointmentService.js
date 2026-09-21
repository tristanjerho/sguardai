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
import { activityLogService } from './activityLogService';

/**
 * Service for real patient appointment booking & chairside queue in Cloud Firestore
 */
export const appointmentService = {
  /**
   * Retrieves all appointments for the clinic queue
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'appointments'));
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        });
      });
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (err) {
      console.error('Error fetching appointments from Firestore:', err);
      throw err;
    }
  },

  /**
   * Retrieves all appointments for a specific patient
   * @param {string} patientId
   * @returns {Promise<Array<Object>>}
   */
  async listForPatient(patientId) {
    if (!db || !patientId) return [];
    try {
      const q = query(collection(db, 'appointments'), where('patientId', '==', patientId));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        });
      });
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (err) {
      console.error('Error fetching patient appointments from Firestore:', err);
      throw err;
    }
  },

  /**
   * Retrieves single appointment by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    if (!db || !id) throw new Error('Appointment ID required');
    const docRef = doc(db, 'appointments', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Appointment not found');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Creates a new real appointment in Firestore with conflict check
   * @param {Object} appointmentData
   * @returns {Promise<Object>}
   */
  async create(appointmentData) {
    if (!db) throw new Error('Firestore is not initialized.');

    const { patientId, dentistId, date, timeSlot, procedureName, notes, patientName } = appointmentData;

    // Check for real slot conflict in Firestore
    const conflictQuery = query(
      collection(db, 'appointments'),
      where('dentistId', '==', dentistId),
      where('date', '==', date),
      where('timeSlot', '==', timeSlot)
    );
    const conflictSnap = await getDocs(conflictQuery);
    const hasConflict = conflictSnap.docs.some((d) => {
      const status = d.data().status;
      return status !== 'CANCELLED';
    });

    if (hasConflict) {
      throw new Error(
        `The requested time slot (${timeSlot} on ${date}) is already booked with this dentist. Please select another slot.`
      );
    }

    const newRecord = {
      patientId,
      patientName: patientName || 'Patient',
      dentistId,
      dentistName: appointmentData.dentistName || 'Attending Dentist',
      date,
      timeSlot,
      procedureName,
      status: 'PENDING',
      notes: notes || '',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'appointments'), newRecord);

    await activityLogService.log({
      userId: patientId,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'APPOINTMENT',
      resourceId: docRef.id,
      entity: `Booked ${procedureName} for ${date} at ${timeSlot}`,
    });

    return {
      id: docRef.id,
      ...newRecord,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Updates status of an appointment (CONFIRMED, IN_CHAIR, COMPLETED, CANCELLED)
   * @param {string} id
   * @param {string} status
   * @param {string} [notes]
   * @param {string} [userId]
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status, notes = '', userId = 'system') {
    if (!db || !id) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'appointments', id);
    const updates = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (notes) updates.statusNotes = notes;

    await updateDoc(docRef, updates);

    await activityLogService.log({
      userId,
      action: 'APPOINTMENT_STATUS_UPDATED',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      entity: `Appointment marked as ${status}`,
    });

    return { id, ...updates };
  },

  /**
   * Reschedules an appointment to a new date and timeSlot
   * @param {string} id
   * @param {string} newDate
   * @param {string} newSlot
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async reschedule(id, newDate, newSlot, userId = 'system') {
    if (!db || !id) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'appointments', id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error('Appointment not found');

    const appointment = existing.data();

    // Check conflict
    const conflictQuery = query(
      collection(db, 'appointments'),
      where('dentistId', '==', appointment.dentistId),
      where('date', '==', newDate),
      where('timeSlot', '==', newSlot)
    );
    const conflictSnap = await getDocs(conflictQuery);
    const hasConflict = conflictSnap.docs.some((d) => d.id !== id && d.data().status !== 'CANCELLED');

    if (hasConflict) {
      throw new Error(`The slot ${newSlot} on ${newDate} is already booked. Please choose another.`);
    }

    const updates = {
      date: newDate,
      timeSlot: newSlot,
      status: 'PENDING',
      rescheduledAt: serverTimestamp(),
    };

    await updateDoc(docRef, updates);

    await activityLogService.log({
      userId,
      action: 'APPOINTMENT_RESCHEDULED',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      entity: `Rescheduled to ${newDate} at ${newSlot}`,
    });

    return { id, ...updates };
  },
};
