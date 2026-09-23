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
import { auth, db } from '../config/firebase';
import { activityLogService } from './activityLogService';
import { notificationService } from './notificationService';

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

    const { patientId, dentistId, date, timeSlot, procedureName, serviceName, notes, patientName } = appointmentData;
    const actualPatientId = auth?.currentUser?.uid || patientId;

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
      return status !== 'CANCELLED' && status !== 'REJECTED';
    });

    if (hasConflict) {
      throw new Error(
        `The requested time slot (${timeSlot} on ${date}) is already booked with this dentist. Please select another slot.`
      );
    }

    const effectiveProcedure = procedureName || serviceName || 'Dental Procedure';

    const newRecord = {
      patientId: actualPatientId,
      patientName: patientName || auth?.currentUser?.displayName || 'Patient',
      dentistId,
      dentistName: appointmentData.dentistName || 'Attending Dentist',
      date,
      timeSlot,
      procedureName: effectiveProcedure,
      status: 'PENDING',
      notes: notes || '',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'appointments'), newRecord);

    // Activity Log
    await activityLogService.log({
      userId: actualPatientId,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'APPOINTMENT',
      resourceId: docRef.id,
      entity: `Booked ${effectiveProcedure} for ${date} at ${timeSlot}`,
    });

    // Notify Patient of submission
    await notificationService.create({
      userId: actualPatientId,
      title: 'Booking Request Submitted 📋',
      message: `Your appointment request for ${effectiveProcedure} with ${appointmentData.dentistName} on ${date} at ${timeSlot} is PENDING confirmation.`,
      type: 'APPOINTMENT',
    });

    // Notify Dentist if specific dentist selected
    if (dentistId) {
      await notificationService.create({
        userId: dentistId,
        title: 'New Booking Request 📅',
        message: `${newRecord.patientName} requested ${effectiveProcedure} on ${date} at ${timeSlot}.`,
        type: 'APPOINTMENT',
      });
    }

    return {
      id: docRef.id,
      ...newRecord,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Updates status of an appointment (CONFIRMED, IN_CHAIR, COMPLETED, CANCELLED, REJECTED)
   * @param {string} id
   * @param {string} status
   * @param {string} [notes]
   * @param {string} [userId]
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status, notes = '', userId = 'system') {
    if (!db || !id) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'appointments', id);
    const existingSnap = await getDoc(docRef);
    const appointment = existingSnap.exists() ? existingSnap.data() : null;

    const updates = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (notes) updates.statusNotes = notes;
    if (status === 'REJECTED') updates.rejectionReason = notes;

    await updateDoc(docRef, updates);

    await activityLogService.log({
      userId,
      action: 'APPOINTMENT_STATUS_UPDATED',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      entity: `Appointment marked as ${status}`,
    });

    // Send targeted real-time notification to patient
    if (appointment?.patientId) {
      let notifTitle = 'Appointment Status Update';
      let notifMessage = `Your appointment status has changed to ${status}.`;

      if (status === 'CONFIRMED') {
        notifTitle = 'Appointment Confirmed! 🎉';
        notifMessage = `Great news! ${appointment.dentistName || 'Your dentist'} has accepted and confirmed your appointment for ${appointment.procedureName || appointment.serviceName || 'treatment'} on ${appointment.date} at ${appointment.timeSlot}.`;
      } else if (status === 'REJECTED') {
        notifTitle = 'Appointment Request Declined ⚠️';
        notifMessage = `Your appointment request for ${appointment.date} was declined. Reason: ${notes || 'Schedule unavailable'}. Please book another time.`;
      } else if (status === 'IN_CHAIR') {
        notifTitle = 'Chairside Consultation Started 🦷';
        notifMessage = `You are now in-chair with ${appointment.dentistName}.`;
      } else if (status === 'COMPLETED') {
        notifTitle = 'Clinical Visit Completed ✅';
        notifMessage = `Your clinical appointment with ${appointment.dentistName} has concluded. Your chart has been updated.`;
      } else if (status === 'CANCELLED') {
        notifTitle = 'Appointment Cancelled';
        notifMessage = `The appointment for ${appointment.date} at ${appointment.timeSlot} has been cancelled.`;
      }

      await notificationService.create({
        userId: appointment.patientId,
        title: notifTitle,
        message: notifMessage,
        type: 'APPOINTMENT',
      });
    }

    return { id, ...updates };
  },

  /**
   * Cancels an appointment with an optional reason
   * @param {string} id
   * @param {string} [reason]
   * @param {string} [userId]
   * @returns {Promise<Object>}
   */
  async cancel(id, reason = '', userId = 'system') {
    return this.updateStatus(id, 'CANCELLED', reason, userId);
  },

  /**
   * Reschedules an appointment to a new date and timeSlot
   * @param {string} id
   * @param {string} newDate
   * @param {string} newSlot
   * @param {string} [dentistId]
   * @param {string} [userId]
   * @returns {Promise<Object>}
   */
  async reschedule(id, newDate, newSlot, dentistId = null, userId = 'system') {
    if (!db || !id) throw new Error('Firestore is not initialized.');

    // Support both (id, newDate, newSlot, userId) and (id, newDate, newSlot, dentistId, userId)
    let effectiveDentistId = dentistId;
    let effectiveUserId = userId;
    if (dentistId && !userId && typeof dentistId === 'string' && !dentistId.startsWith('dentist_')) {
      // If only 4 arguments were passed and 4th is userId
      effectiveUserId = dentistId;
      effectiveDentistId = null;
    }

    const docRef = doc(db, 'appointments', id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error('Appointment not found');

    const appointment = existing.data();
    const targetDentistId = effectiveDentistId || appointment.dentistId;

    // Check conflict
    const conflictQuery = query(
      collection(db, 'appointments'),
      where('dentistId', '==', targetDentistId),
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
    if (effectiveDentistId) {
      updates.dentistId = effectiveDentistId;
    }

    await updateDoc(docRef, updates);

    await activityLogService.log({
      userId: effectiveUserId || 'system',
      action: 'APPOINTMENT_RESCHEDULED',
      resourceType: 'APPOINTMENT',
      resourceId: id,
      entity: `Rescheduled to ${newDate} at ${newSlot}`,
    });

    if (appointment?.patientId) {
      await notificationService.create({
        userId: appointment.patientId,
        title: 'Appointment Rescheduled 🔄',
        message: `Your appointment with ${appointment.dentistName || 'your dentist'} has been moved to ${newDate} at ${newSlot}.`,
        type: 'APPOINTMENT',
      });
    }

    return { id, ...updates };
  },

  /**
   * Realtime Firestore subscription for appointments
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToAppointments(callback) {
    if (!db) {
      callback([]);
      return () => {};
    }
    const q = collection(db, 'appointments');
    return onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          });
        });
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        callback(list);
      },
      (err) => {
        console.error('Realtime appointments listener error:', err);
      }
    );
  },
};
