import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ROLES } from '../lib/roles';
import { imageService } from './imageService';
import { activityLogService } from './activityLogService';

/** Default inactivity threshold (1 year = 365 days) for flagging patients eligible for archiving */
export const INACTIVITY_THRESHOLD_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Safely converts Firestore Timestamp, Date, YYYY-MM-DD string, or ISO string to epoch milliseconds.
 * @param {any} val
 * @returns {number|null}
 */
export function toTimestampMs(val) {
  if (!val) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.toDate === 'function') {
    const d = val.toDate();
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val.getTime();
  if (typeof val === 'string') {
    const ymd = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      const local = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      return Number.isNaN(local.getTime()) ? null : local.getTime();
    }
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  return null;
}

/**
 * Formats an inactivity duration in days into a clear clinical label (e.g. "1 yr, 3 mos ago").
 * @param {number|null} days
 * @returns {string}
 */
export function formatInactivityDuration(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) {
    return 'No clinic activity recorded';
  }
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const totalMonths = Math.floor(days / 30.4375);
  if (totalMonths < 12) {
    return `${totalMonths} ${totalMonths === 1 ? 'mo' : 'mos'} ago`;
  }
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30.4375);
  if (remMonths === 0) {
    return `${years} ${years === 1 ? 'yr' : 'yrs'} ago`;
  }
  return `${years} ${years === 1 ? 'yr' : 'yrs'}, ${remMonths} ${remMonths === 1 ? 'mo' : 'mos'} ago`;
}

/**
 * Service for patient clinical profiles, diagnostic records, and brushing habit tracker
 */
export const patientService = {
  /**
   * Retrieves all registered patients from Firestore for the clinic directory
   * @returns {Promise<Array<Object>>}
   */
  async listPatients() {
    if (!db) return [];
    try {
      const q = query(collection(db, 'users'), where('role', '==', ROLES.PATIENT));
      const snapshot = await getDocs(q);
      const patients = [];
      snapshot.forEach((docSnap) => {
        patients.push({ id: docSnap.id, ...docSnap.data() });
      });
      return patients;
    } catch (err) {
      console.error('Error fetching patients from Firestore:', err);
      throw err;
    }
  },

  /**
   * Retrieves patient document by ID
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async getById(patientId) {
    if (!db || !patientId) throw new Error('Patient ID is required');
    const docRef = doc(db, 'users', patientId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Patient not found');
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Retrieves dental radiographs and photographic records via imageService
   * @param {string} patientId
   * @returns {Promise<Array<Object>>}
   */
  async getRecords(patientId) {
    return imageService.getPatientImages(patientId);
  },

  /**
   * Retrieves brushing habit streak for a patient from Firestore
   * @param {string} [patientId]
   * @returns {Promise<Object>}
   */
  async getBrushStreak(patientId) {
    const effectivePatientId = patientId || auth?.currentUser?.uid;
    if (!db || !effectivePatientId) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        lastCheckInDate: null,
        history: {},
        unlockedBadges: [],
      };
    }

    try {
      const docRef = doc(db, 'brushStreaks', effectivePatientId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalPoints: 0,
          lastCheckInDate: null,
          history: {},
          unlockedBadges: [],
        };
      }
      return snap.data();
    } catch (err) {
      console.error('Error fetching brush streak:', err);
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        lastCheckInDate: null,
        history: {},
        unlockedBadges: [],
      };
    }
  },

  /**
   * Logs a real brushing session (morning/night) for a patient in Firestore
   * @param {string} [patientId]
   * @param {'morning'|'night'} sessionType
   * @returns {Promise<Object>}
   */
  async recordBrush(patientId, sessionType) {
    const effectivePatientId = patientId || auth?.currentUser?.uid;
    if (!db) throw new Error('Firestore is not initialized.');
    if (!effectivePatientId) throw new Error('Please sign in to log your brushing check-in.');

    const docRef = doc(db, 'brushStreaks', effectivePatientId);
    const streak = await this.getBrushStreak(effectivePatientId);
    const today = new Date().toISOString().split('T')[0];

    const todayHistory = streak.history?.[today] || { morning: false, night: false };
    if (todayHistory[sessionType]) {
      throw new Error(`You have already logged your ${sessionType} brushing session today!`);
    }

    const updatedTodayHistory = { ...todayHistory, [sessionType]: true };
    const updatedHistory = { ...(streak.history || {}), [today]: updatedTodayHistory };

    let currentStreak = streak.currentStreak || 0;
    const isFirstSessionToday = !todayHistory.morning && !todayHistory.night;

    if (isFirstSessionToday) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (streak.lastCheckInDate === yesterday || !streak.lastCheckInDate) {
        currentStreak += 1;
      } else if (streak.lastCheckInDate !== today) {
        currentStreak = 1;
      }
    }

    const longestStreak = Math.max(streak.longestStreak || 0, currentStreak);
    const pointsGained = 25;
    const totalPoints = (streak.totalPoints || 0) + pointsGained;

    // Check newly unlocked badges
    const unlockedBadges = [...(streak.unlockedBadges || [])];
    const newBadges = [];
    if (currentStreak >= 3 && !unlockedBadges.includes('badge-3-days')) {
      unlockedBadges.push('badge-3-days');
      newBadges.push('3-Day Sparkle');
    }
    if (currentStreak >= 7 && !unlockedBadges.includes('badge-7-days')) {
      unlockedBadges.push('badge-7-days');
      newBadges.push('7-Day Diamond');
    }
    if (currentStreak >= 30 && !unlockedBadges.includes('badge-30-days')) {
      unlockedBadges.push('badge-30-days');
      newBadges.push('30-Day Master');
    }

    const updatedStreak = {
      patientId: effectivePatientId,
      currentStreak,
      longestStreak,
      totalPoints,
      lastCheckInDate: today,
      history: updatedHistory,
      unlockedBadges,
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, updatedStreak, { merge: true });

    try {
      await activityLogService.log({
        userId: effectivePatientId,
        action: 'BRUSH_SESSION_LOGGED',
        resourceType: 'BRUSH_STREAK',
        resourceId: effectivePatientId,
        entity: `Logged ${sessionType} brushing (+${pointsGained} pts, streak: ${currentStreak} days)`,
      });
    } catch (logErr) {
      console.warn('Non-critical audit log error:', logErr);
    }

    return { ...updatedStreak, newBadges, pointsGained };
  },

  /**
   * Alias for recordBrush
   */
  async recordBrushCheckIn(patientId, sessionType) {
    return this.recordBrush(patientId, sessionType);
  },

  /**
   * Updates clinical details of a patient
   * @param {string} patientId
   * @param {Object} updates
   * @param {string} [dentistId]
   * @returns {Promise<Object>}
   */
  async updatePatient(patientId, updates, dentistId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'users', patientId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: dentistId,
      action: 'PATIENT_UPDATED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Updated patient chart/profile for ${patientId}`,
    });

    return this.getById(patientId);
  },

  /**
   * Validates completeness of a patient record before finalization.
   * Checks full name, valid phone, date of birth, privacy consent (RA 10173),
   * and emergency contact information.
   * @param {Object} patient
   * @returns {{ isComplete: boolean, missingFields: string[] }}
   */
  validateRecordCompleteness(patient) {
    if (!patient) return { isComplete: false, missingFields: ['Patient record missing'] };
    const missing = [];
    if (!patient.fullName || !patient.fullName.trim()) missing.push('Full Legal Name');
    if (!patient.phone || !patient.phone.trim()) missing.push('Contact Phone Number');
    if (!patient.dateOfBirth && !patient.dob) missing.push('Date of Birth');
    if (!patient.privacyConsent) missing.push('RA 10173 Data Privacy Statutory Consent');
    if (!patient.emergencyContactName && !patient.emergencyContact?.name && !patient.emergencyContact) {
      missing.push('Emergency Contact Information');
    }
    return {
      isComplete: missing.length === 0,
      missingFields: missing,
    };
  },

  /**
   * Finalizes a patient record once completeness validation passes.
   * Keeps patient record completion separate from treatment completion.
   */
  async finalizePatientRecord(patientId, practitionerName = 'Attending Dentist', practitionerId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');
    const patient = await this.getById(patientId);
    const validation = this.validateRecordCompleteness(patient);
    if (!validation.isComplete) {
      throw new Error(`Cannot finalize record. Missing required clinical onboarding fields: ${validation.missingFields.join(', ')}`);
    }

    const docRef = doc(db, 'users', patientId);
    await updateDoc(docRef, {
      recordStatus: 'FINALIZED',
      finalizedAt: serverTimestamp(),
      finalizedBy: {
        name: practitionerName,
        id: practitionerId,
      },
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: practitionerId,
      action: 'PATIENT_RECORD_FINALIZED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Finalized clinical chart & record for ${patient.fullName || patientId} by ${practitionerName}`,
    });

    return this.getById(patientId);
  },

  /**
   * Amends a finalized patient record with an explicit, auditable clinical reason.
   */
  async amendFinalizedRecord(patientId, updates, amendmentReason, practitionerName = 'Attending Dentist', practitionerId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');
    if (!amendmentReason || !amendmentReason.trim()) {
      throw new Error('An authorized clinical amendment reason is required when updating a finalized record.');
    }

    const amendmentEntry = {
      amendedAt: new Date().toISOString(),
      amendedBy: practitionerName,
      amendedById: practitionerId,
      reason: amendmentReason.trim(),
      modifiedFields: Object.keys(updates),
    };

    const docRef = doc(db, 'users', patientId);
    await updateDoc(docRef, {
      ...updates,
      amendmentHistory: arrayUnion(amendmentEntry),
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: practitionerId,
      action: 'PATIENT_RECORD_AMENDED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Amended finalized chart for ${patientId}: ${amendmentReason.trim()} (by ${practitionerName})`,
    });

    return this.getById(patientId);
  },

  /**
   * Archives a patient record (e.g., historical archive 2010-2015 or inactive case).
   * Archived records remain accessible for audit/review.
   */
  async archivePatient(patientId, reason = 'Historical archive', actorName = 'Admin', actorId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');
    const docRef = doc(db, 'users', patientId);
    const archiveEntry = {
      action: 'ARCHIVED',
      timestamp: new Date().toISOString(),
      by: actorName,
      byId: actorId,
      reason,
    };
    await updateDoc(docRef, {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedReason: reason,
      archivedBy: actorName,
      archiveAuditLog: arrayUnion(archiveEntry),
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actorId,
      action: 'PATIENT_ARCHIVED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Archived patient case file ${patientId} (Reason: ${reason}) by ${actorName}`,
    });

    return this.getById(patientId);
  },

  /**
   * Restores an archived patient record to active status.
   */
  async restorePatient(patientId, actorName = 'Admin', actorId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');
    const docRef = doc(db, 'users', patientId);
    const restoreEntry = {
      action: 'RESTORED',
      timestamp: new Date().toISOString(),
      by: actorName,
      byId: actorId,
      reason: 'Reactivated patient chart file',
    };
    await updateDoc(docRef, {
      isArchived: false,
      restoredAt: serverTimestamp(),
      restoredBy: actorName,
      archiveAuditLog: arrayUnion(restoreEntry),
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actorId,
      action: 'PATIENT_RESTORED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Restored archived patient case file ${patientId} to active roster by ${actorName}`,
    });

    return this.getById(patientId);
  },

  /**
   * Assigns or reassigns an attending dentist to a patient case file.
   */
  async assignDentist(patientId, dentistId, dentistName, actorName = 'Staff', actorId = 'system') {
    if (!db || !patientId) throw new Error('Firestore is not initialized.');
    const docRef = doc(db, 'users', patientId);
    await updateDoc(docRef, {
      assignedDentistId: dentistId,
      assignedDentistName: dentistName,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      userId: actorId,
      action: 'PATIENT_DENTIST_ASSIGNED',
      resourceType: 'USER',
      resourceId: patientId,
      entity: `Assigned patient ${patientId} to dentist ${dentistName} by ${actorName}`,
    });

    return this.getById(patientId);
  },

  /**
   * Builds a complete archive & inactivity overview for all registered patients by
   * cross-referencing appointments and stored radiographs/documents.
   * Flags active patients whose last clinic activity was >= thresholdDays (default 365 days / 1 year).
   * @param {number} [thresholdDays=INACTIVITY_THRESHOLD_DAYS]
   * @returns {Promise<Array<Object>>}
   */
  async listArchiveOverview(thresholdDays = INACTIVITY_THRESHOLD_DAYS) {
    if (!db) return [];

    const [patients, appointmentsSnap, imagesSnap] = await Promise.all([
      this.listPatients(),
      getDocs(collection(db, 'appointments')).catch(() => null),
      getDocs(collection(db, 'dentalImages')).catch(() => null),
    ]);

    const apptsByPatient = new Map();
    if (appointmentsSnap) {
      appointmentsSnap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (!data.patientId) return;
        const list = apptsByPatient.get(data.patientId) || [];
        list.push(data);
        apptsByPatient.set(data.patientId, list);
      });
    }

    const docsByPatient = new Map();
    if (imagesSnap) {
      imagesSnap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (!data.patientId) return;
        const list = docsByPatient.get(data.patientId) || [];
        list.push(data);
        docsByPatient.set(data.patientId, list);
      });
    }

    const nowMs = Date.now();

    return patients.map((p) => {
      const pAppts = apptsByPatient.get(p.id) || [];
      const pDocs = docsByPatient.get(p.id) || [];

      const completedAppts = pAppts.filter((a) => a.status === 'COMPLETED');
      const activeOrPastAppts = pAppts.filter(
        (a) => a.status !== 'CANCELLED' && a.status !== 'REJECTED'
      );

      const getLatestApptMs = (list) => {
        let best = null;
        let bestAppt = null;
        list.forEach((a) => {
          const ms =
            toTimestampMs(a.date) ??
            toTimestampMs(a.completedAt) ??
            toTimestampMs(a.updatedAt) ??
            toTimestampMs(a.createdAt);
          if (ms !== null && ms <= nowMs && (best === null || ms > best)) {
            best = ms;
            bestAppt = a;
          }
        });
        return { ms: best, appt: bestAppt };
      };

      const latestCompleted = getLatestApptMs(completedAppts);
      const latestAnyAppt = getLatestApptMs(activeOrPastAppts);
      const explicitLastVisitMs = toTimestampMs(p.lastVisitAt);

      let latestDocMs = null;
      pDocs.forEach((img) => {
        const ms = toTimestampMs(img.createdAt);
        if (ms !== null && (latestDocMs === null || ms > latestDocMs)) {
          latestDocMs = ms;
        }
      });

      const createdMs = toTimestampMs(p.createdAt);

      let lastVisitMs = null;
      let lastVisitSource = 'UNKNOWN';
      let latestProcedure = '';

      if (latestCompleted.ms !== null) {
        lastVisitMs = latestCompleted.ms;
        lastVisitSource = 'COMPLETED_VISIT';
        latestProcedure =
          latestCompleted.appt?.procedureName || latestCompleted.appt?.serviceName || '';
      } else if (explicitLastVisitMs !== null) {
        lastVisitMs = explicitLastVisitMs;
        lastVisitSource = 'LAST_VISIT_FIELD';
      } else if (latestAnyAppt.ms !== null) {
        lastVisitMs = latestAnyAppt.ms;
        lastVisitSource = 'APPOINTMENT';
        latestProcedure =
          latestAnyAppt.appt?.procedureName || latestAnyAppt.appt?.serviceName || '';
      } else if (latestDocMs !== null) {
        lastVisitMs = latestDocMs;
        lastVisitSource = 'IMAGING';
      } else if (createdMs !== null) {
        lastVisitMs = createdMs;
        lastVisitSource = 'REGISTRATION';
      }

      // If explicit lastVisitAt is even newer than latestCompleted, prefer the more recent one
      if (explicitLastVisitMs !== null && (lastVisitMs === null || explicitLastVisitMs > lastVisitMs)) {
        lastVisitMs = explicitLastVisitMs;
      }

      const daysSinceLastVisit =
        lastVisitMs !== null ? Math.max(0, Math.floor((nowMs - lastVisitMs) / DAY_MS)) : null;
      const yearsSinceLastVisit =
        daysSinceLastVisit !== null ? Number((daysSinceLastVisit / 365).toFixed(1)) : null;
      const isInactiveEligible =
        !p.isArchived && daysSinceLastVisit !== null && daysSinceLastVisit >= thresholdDays;

      return {
        ...p,
        lastVisitMs,
        lastVisitDate: lastVisitMs !== null ? new Date(lastVisitMs).toISOString() : null,
        lastVisitSource,
        daysSinceLastVisit,
        yearsSinceLastVisit,
        inactivityLabel: formatInactivityDuration(daysSinceLastVisit),
        isInactiveEligible,
        visitCount: pAppts.length,
        completedVisitCount: completedAppts.length,
        documentCount: pDocs.length,
        latestProcedure,
      };
    });
  },

  /**
   * Bulk-archives multiple patient records (e.g., all patients inactive for 1+ year).
   * @param {Array<string>} patientIds
   * @param {string} reason
   * @param {string} actorName
   * @param {string} actorId
   * @returns {Promise<{ succeeded: Array<string>, failed: Array<{ id: string, error: string }> }>}
   */
  async archivePatientsBulk(
    patientIds,
    reason = 'Inactive for 1+ year — moved to historical archive',
    actorName = 'Attending Dentist',
    actorId = 'system'
  ) {
    const succeeded = [];
    const failed = [];

    for (const pid of patientIds || []) {
      try {
        await this.archivePatient(pid, reason, actorName, actorId);
        succeeded.push(pid);
      } catch (err) {
        failed.push({ id: pid, error: err?.message || 'Failed to archive' });
      }
    }

    return { succeeded, failed };
  },
};
