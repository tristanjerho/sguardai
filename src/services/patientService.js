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
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ROLES } from '../lib/roles';
import { imageService } from './imageService';
import { activityLogService } from './activityLogService';

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
};
