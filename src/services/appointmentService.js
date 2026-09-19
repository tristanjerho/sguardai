import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';
import { APPOINTMENT_STATUS, SERVICES } from '../lib/constants';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

/**
 * Service for appointment scheduling and queue management
 */
export const appointmentService = {
  /**
   * Retrieves all appointments (sorted by date descending)
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    await delay(300);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    return [...list].sort((a, b) => new Date(`${b.date}T${b.timeSlot}`) - new Date(`${a.date}T${a.timeSlot}`));
  },

  /**
   * Retrieves all appointments for a patient
   * @param {string} patientId
   * @returns {Promise<Array<Object>>}
   */
  async listForPatient(patientId) {
    await delay(250);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    return list
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  /**
   * Retrieves appointment by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    await delay(150);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    const found = list.find((a) => a.id === id);
    if (!found) throw new Error('Appointment not found');
    return found;
  },

  /**
   * Checks whether a specific dentist has a confirmed/pending appointment on date & time
   * @param {string} dentistId
   * @param {string} date (YYYY-MM-DD)
   * @param {string} timeSlot
   * @param {string} excludeId (optional, for rescheduling)
   * @returns {Promise<boolean>} true if slot is available, false if busy
   */
  async checkSlotAvailability(dentistId, date, timeSlot, excludeId = null) {
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    const conflict = list.some(
      (a) =>
        a.dentistId === dentistId &&
        a.date === date &&
        a.timeSlot === timeSlot &&
        a.status !== APPOINTMENT_STATUS.CANCELLED &&
        a.status !== APPOINTMENT_STATUS.REJECTED &&
        a.id !== excludeId
    );
    return !conflict;
  },

  /**
   * Creates a new booking in PENDING status with conflict validation
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    await delay(350);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);

    // 1. Double-booking check
    const isAvailable = await this.checkSlotAvailability(data.dentistId, data.date, data.timeSlot);
    if (!isAvailable) {
      throw new Error(
        `The selected time slot (${data.timeSlot} on ${data.date}) is no longer available with this specialist. Please select another slot.`
      );
    }

    const serviceObj = SERVICES.find((s) => s.id === data.serviceId);

    const newAppointment = {
      id: `apt-${Date.now()}`,
      patientId: data.patientId,
      patientName: data.patientName,
      dentistId: data.dentistId,
      dentistName: data.dentistName,
      serviceId: data.serviceId,
      serviceName: serviceObj ? serviceObj.name : data.serviceName || 'Dental Procedure',
      date: data.date,
      timeSlot: data.timeSlot,
      status: APPOINTMENT_STATUS.PENDING,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };

    list.unshift(newAppointment);
    setStorageItem(STORAGE_KEYS.APPOINTMENTS, list);

    // Create notification for patient
    await notificationService.create({
      userId: data.patientId,
      title: 'Appointment Request Submitted',
      message: `Your booking for ${newAppointment.serviceName} on ${data.date} at ${data.timeSlot} was submitted and is awaiting clinic confirmation.`,
      type: 'APPOINTMENT',
    });

    // Log action
    await activityLogService.log({
      actor: `${data.patientName} (Patient)`,
      action: 'BOOKED_APPOINTMENT',
      entity: `Appointment for ${newAppointment.serviceName} on ${data.date}`,
    });

    return newAppointment;
  },

  /**
   * Updates status of an appointment (Approve / Reject / Complete)
   * @param {string} appointmentId
   * @param {string} newStatus
   * @param {string} rejectionReason
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async updateStatus(appointmentId, newStatus, rejectionReason = '', actorName = 'Dentist') {
    await delay(300);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    const index = list.findIndex((a) => a.id === appointmentId);

    if (index === -1) throw new Error('Appointment not found');

    const appointment = list[index];
    appointment.status = newStatus;

    if (newStatus === APPOINTMENT_STATUS.REJECTED) {
      if (!rejectionReason.trim()) {
        throw new Error('A rejection reason is required to reject an appointment.');
      }
      appointment.rejectionReason = rejectionReason;
    }

    list[index] = appointment;
    setStorageItem(STORAGE_KEYS.APPOINTMENTS, list);

    // Notify patient of status change
    let notifTitle = 'Appointment Status Updated';
    let notifMsg = `Your appointment on ${appointment.date} is now ${newStatus}.`;

    if (newStatus === APPOINTMENT_STATUS.CONFIRMED) {
      notifTitle = 'Appointment Confirmed!';
      notifMsg = `Your ${appointment.serviceName} on ${appointment.date} at ${appointment.timeSlot} with ${appointment.dentistName} has been approved.`;
    } else if (newStatus === APPOINTMENT_STATUS.REJECTED) {
      notifTitle = 'Appointment Request Declined';
      notifMsg = `Your appointment on ${appointment.date} could not be confirmed. Reason: "${rejectionReason}". Please book an alternative slot.`;
    } else if (newStatus === APPOINTMENT_STATUS.COMPLETED) {
      notifTitle = 'Appointment Completed';
      notifMsg = `Thank you for visiting today! Your appointment for ${appointment.serviceName} has been marked completed.`;
    }

    await notificationService.create({
      userId: appointment.patientId,
      title: notifTitle,
      message: notifMsg,
      type: 'APPOINTMENT',
    });

    // Log action
    await activityLogService.log({
      actor: actorName,
      action: `${newStatus}_APPOINTMENT`,
      entity: `Appointment #${appointment.id} for ${appointment.patientName}`,
    });

    return appointment;
  },

  /**
   * Reschedules an appointment
   * @param {string} appointmentId
   * @param {string} newDate
   * @param {string} newTimeSlot
   * @param {string} newDentistId
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async reschedule(appointmentId, newDate, newTimeSlot, newDentistId, actorName = 'Patient') {
    await delay(350);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    const index = list.findIndex((a) => a.id === appointmentId);

    if (index === -1) throw new Error('Appointment not found');

    const appointment = list[index];
    const dentistId = newDentistId || appointment.dentistId;

    const isAvailable = await this.checkSlotAvailability(dentistId, newDate, newTimeSlot, appointmentId);
    if (!isAvailable) {
      throw new Error(`The slot (${newTimeSlot} on ${newDate}) is unavailable.`);
    }

    appointment.date = newDate;
    appointment.timeSlot = newTimeSlot;
    if (newDentistId) appointment.dentistId = newDentistId;
    appointment.status = APPOINTMENT_STATUS.PENDING; // Needs re-approval

    list[index] = appointment;
    setStorageItem(STORAGE_KEYS.APPOINTMENTS, list);

    await notificationService.create({
      userId: appointment.patientId,
      title: 'Appointment Rescheduled',
      message: `Your appointment has been moved to ${newDate} at ${newTimeSlot} and is pending confirmation.`,
      type: 'APPOINTMENT',
    });

    await activityLogService.log({
      actor: actorName,
      action: 'RESCHEDULED_APPOINTMENT',
      entity: `Moved Appointment #${appointment.id} to ${newDate} ${newTimeSlot}`,
    });

    return appointment;
  },

  /**
   * Cancels an appointment
   * @param {string} appointmentId
   * @param {string} reason
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async cancel(appointmentId, reason = '', actorName = 'Patient') {
    await delay(250);
    const list = getStorageItem(STORAGE_KEYS.APPOINTMENTS, []);
    const index = list.findIndex((a) => a.id === appointmentId);

    if (index === -1) throw new Error('Appointment not found');

    const appointment = list[index];
    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancelReason = reason;

    list[index] = appointment;
    setStorageItem(STORAGE_KEYS.APPOINTMENTS, list);

    await notificationService.create({
      userId: appointment.patientId,
      title: 'Appointment Cancelled',
      message: `Your appointment on ${appointment.date} at ${appointment.timeSlot} was cancelled.`,
      type: 'APPOINTMENT',
    });

    await activityLogService.log({
      actor: actorName,
      action: 'CANCELLED_APPOINTMENT',
      entity: `Cancelled appointment #${appointment.id}`,
    });

    return appointment;
  },
};
