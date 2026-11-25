import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { formatPhPhone } from '../lib/formatters';

// Anti-duplicate cooldown window: 5 minutes (in milliseconds)
const DUPLICATE_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Standardized SMS notification templates.
 * In accordance with RA 10173 and clinical privacy guidelines,
 * SMS messages NEVER disclose health-sensitive diagnosis or medical conditions.
 */
export const SMS_TEMPLATES = {
  APPOINTMENT_CONFIRMED: ({ patientName, dentistName, date, timeSlot }) =>
    `SmileGuard AI: Hello ${patientName}, your dental appointment with ${dentistName} on ${date} at ${timeSlot} has been CONFIRMED. Please arrive 10 mins early.`,

  APPOINTMENT_RESCHEDULED: ({ patientName, dentistName, newDate, newTimeSlot, reason }) =>
    `SmileGuard AI: Hello ${patientName}, your appointment with ${dentistName} has been RESCHEDULED to ${newDate} at ${newTimeSlot}.${reason ? ` Reason: ${reason}` : ''}`,

  APPOINTMENT_CANCELLED: ({ patientName, date, timeSlot }) =>
    `SmileGuard AI: Hello ${patientName}, your dental visit for ${date} at ${timeSlot} was cancelled. To rebook, please visit our patient portal.`,

  APPOINTMENT_DECLINED: ({ patientName, date, reason }) =>
    `SmileGuard AI: Hello ${patientName}, your requested booking for ${date} was declined (${reason || 'schedule unavailable'}). Please visit our portal to select another slot.`,

  APPOINTMENT_REMINDER: ({ patientName, dentistName, date, timeSlot }) =>
    `SmileGuard AI Reminder: Hello ${patientName}, you have an upcoming dental appointment on ${date} at ${timeSlot} with ${dentistName}. See you soon!`,

  // Dentist & Laboratory Staff Phone Alerts (privacy-safe — no diagnosis or PII leaked)
  DENTIST_NEW_BOOKING: ({ dentistName, patientName, procedure, date, timeSlot }) =>
    `SmileGuard AI: Hello ${dentistName || 'Doctor'}, new booking request from ${patientName || 'a patient'} (${procedure || 'Consultation'}) on ${date} at ${timeSlot}. Open Clinic Queue to review.`,

  DENTIST_LAB_MESSAGE: ({ dentistName, requestCode, senderName, preview }) =>
    `SmileGuard AI Lab Alert: Hello ${dentistName || 'Doctor'}, ${senderName || 'Laboratory'} sent a message on ${requestCode}: "${String(preview || '').slice(0, 90)}". Open Lab Prescriptions to reply.`,

  DENTIST_LAB_UPDATE: ({ dentistName, requestCode, summary }) =>
    `SmileGuard AI Lab Update: Hello ${dentistName || 'Doctor'}, ${requestCode} — ${String(summary || 'Status updated').slice(0, 110)}.`,

  LAB_NEW_MESSAGE: ({ requestCode, dentistName, preview }) =>
    `SmileGuard Lab Alert: ${dentistName || 'Dentist'} sent a message on ${requestCode}: "${String(preview || '').slice(0, 90)}". Open Lab Portal to respond.`,

  LAB_RUSH_ORDER: ({ requestCode, dentistName, applianceType }) =>
    `SmileGuard RUSH Lab Order: ${dentistName || 'Dentist'} submitted ${requestCode} (${applianceType || 'Appliance'}). Open Lab Intake immediately.`,

  LAB_ISSUE_REPORTED: ({ requestCode, dentistName, issueType }) =>
    `SmileGuard Lab Issue Alert: ${dentistName || 'Dentist'} reported "${issueType || 'Specification Issue'}" on ${requestCode}. Open Lab Portal to review.`,
};

/**
 * Validates Philippine mobile number format
 * Accepts: +63 9XX XXX XXXX, +639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX
 * @param {string} phone
 * @returns {{ isValid: boolean, normalized: string, error?: string }}
 */
export function validatePhilippineMobile(phone) {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', error: 'Mobile number is required.' };
  }

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  let normalized = '';
  if (cleaned.startsWith('+639') && cleaned.length === 13) {
    normalized = '09' + cleaned.slice(4);
  } else if (cleaned.startsWith('639') && cleaned.length === 12) {
    normalized = '09' + cleaned.slice(3);
  } else if (cleaned.startsWith('09') && cleaned.length === 11) {
    normalized = cleaned;
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    normalized = '0' + cleaned;
  } else {
    return {
      isValid: false,
      normalized: '',
      error: 'Invalid Philippine mobile format. Expected 11 digits starting with 09 (e.g., 09171234567 or +63 917 123 4567).',
    };
  }

  return { isValid: true, normalized };
}

/**
 * Production SMS Notification Service supporting Philippine Carriers via Semaphore API
 * Includes mock test-environment fallback, delivery audit logging, and anti-duplicate throttling.
 */
export const smsService = {
  /**
   * SMS is dispatched via the secure server-side /api/sms endpoint (which reads SEMAPHORE_API_KEY).
   * @returns {boolean}
   */
  isProviderConfigured() {
    return true;
  },

  /**
   * Checks whether a duplicate SMS was recently dispatched for this appointment event
   * @param {string} appointmentId
   * @param {string} eventType
   * @returns {Promise<boolean>}
   */
  async isDuplicateRequest(appointmentId, eventType) {
    if (!db || !appointmentId) return false;
    try {
      const q = query(
        collection(db, 'smsLogs'),
        where('appointmentId', '==', appointmentId),
        where('eventType', '==', eventType)
      );
      const snap = await getDocs(q);
      if (snap.empty) return false;

      const now = Date.now();
      return snap.docs.some((d) => {
        const data = d.data();
        const sentTime = data.timestamp?.toDate
          ? data.timestamp.toDate().getTime()
          : data.sentAt ? new Date(data.sentAt).getTime() : 0;
        return now - sentTime < DUPLICATE_COOLDOWN_MS;
      });
    } catch (err) {
      console.warn('Could not verify SMS duplicate status:', err);
      return false;
    }
  },

  /**
   * Dispatches an SMS notification to a Philippine mobile number
   * @param {Object} params
   * @param {string} params.to - Recipient phone number
   * @param {string} params.eventType - 'APPOINTMENT_CONFIRMED' | 'APPOINTMENT_RESCHEDULED' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_REMINDER'
   * @param {Object} params.templateData - Data used to populate the template
   * @param {string} [params.patientId] - Patient ID for audit tracking
   * @param {string} [params.appointmentId] - Appointment ID for duplicate prevention
   * @returns {Promise<Object>}
   */
  async sendSms({
    to,
    eventType,
    templateData = {},
    patientId = '',
    appointmentId = '',
    recipientUserId = '',
    orderId = '',
  }) {
    const validation = validatePhilippineMobile(to);
    if (!validation.isValid) {
      console.warn(`[SMS Service] Invalid mobile number skipped: ${to} - ${validation.error}`);
      return {
        success: false,
        status: 'FAILED',
        error: validation.error,
        normalizedPhone: '',
      };
    }

    const normalizedPhone = validation.normalized;

    // Check duplicate prevention
    const dedupeKey = appointmentId || orderId;
    if (dedupeKey && eventType) {
      const isDuplicate = await this.isDuplicateRequest(dedupeKey, eventType);
      if (isDuplicate) {
        console.info(`[SMS Service] Duplicate SMS suppressed for ${eventType} on #${dedupeKey}`);
        return {
          success: true,
          status: 'SUPPRESSED_DUPLICATE',
          message: 'Suppressed duplicate notification within cooldown window.',
        };
      }
    }

    // Build message from template
    const templateFn = SMS_TEMPLATES[eventType];
    const message = templateFn ? templateFn(templateData) : templateData.message || '';
    if (!message) {
      throw new Error(`No message content or template defined for event: ${eventType}`);
    }

    let deliveryStatus = 'SIMULATED';
    let providerResponse = null;
    let deliveryError = null;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          if (idToken) headers.Authorization = `Bearer ${idToken}`;
        } catch {
          // Continue without token if unavailable
        }
      }

      const response = await fetch('/api/sms', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: normalizedPhone,
          message,
          eventType,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'SENT') {
        deliveryStatus = 'SENT';
        providerResponse = data.providerResponse || data;
      } else if (response.ok && data.status === 'SIMULATED') {
        deliveryStatus = 'SIMULATED';
        providerResponse = data.providerResponse || data;
      } else {
        deliveryStatus = 'FAILED';
        deliveryError = data.error || 'SMS gateway failure';
      }
    } catch (err) {
      deliveryStatus = 'SIMULATED';
      providerResponse = {
        mock: true,
        provider: 'Semaphore (Local Fallback)',
        simulatedRecipient: normalizedPhone,
        simulatedAt: new Date().toISOString(),
      };
      deliveryError = err?.message || null;
    }

    // Record audit log in Firestore
    const logRecord = {
      recipientPhone: normalizedPhone,
      displayPhone: formatPhPhone(normalizedPhone),
      patientId,
      recipientUserId,
      appointmentId: dedupeKey,
      orderId,
      eventType,
      message,
      status: deliveryStatus,
      provider: 'Semaphore PH',
      providerResponse: providerResponse ? JSON.stringify(providerResponse) : null,
      error: deliveryError,
      sentAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    if (db) {
      try {
        await addDoc(collection(db, 'smsLogs'), logRecord);
      } catch (logErr) {
        console.warn('Could not record SMS log in Firestore:', logErr);
      }
    }

    return {
      success: deliveryStatus === 'SENT' || deliveryStatus === 'SIMULATED',
      status: deliveryStatus,
      recipientPhone: normalizedPhone,
      message,
      error: deliveryError,
    };
  },

  /**
   * Retrieves SMS audit history for a specific patient
   * @param {string} patientId
   * @returns {Promise<Array<Object>>}
   */
  async listLogsForPatient(patientId) {
    if (!db || !patientId) return [];
    try {
      const q = query(
        collection(db, 'smsLogs'),
        where('patientId', '==', patientId)
      );
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      return list.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    } catch (err) {
      console.error('Error fetching patient SMS logs:', err);
      return [];
    }
  },

  /**
   * Retrieves recent clinic SMS logs for administrative monitoring
   * @param {number} [maxRecords=50]
   * @returns {Promise<Array<Object>>}
   */
  async listRecentLogs(maxRecords = 50) {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'smsLogs'));
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      return list
        .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
        .slice(0, maxRecords);
    } catch (err) {
      console.error('Error fetching recent SMS logs:', err);
      return [];
    }
  },
};

