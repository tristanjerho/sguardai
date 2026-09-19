import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';
import { ROLES } from '../lib/roles';
import { notificationService } from './notificationService';

/**
 * Service for patient profiles, records, and brushing streaks
 */
export const patientService = {
  /**
   * Retrieves all registered patients (for clinic directory)
   * @returns {Promise<Array<Object>>}
   */
  async listPatients() {
    await delay(250);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    return users.filter((u) => u.role === ROLES.PATIENT);
  },

  /**
   * Retrieves patient by user ID
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async getById(patientId) {
    await delay(200);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const patient = users.find((u) => u.id === patientId && u.role === ROLES.PATIENT);
    if (!patient) throw new Error('Patient not found');
    return patient;
  },

  /**
   * Retrieves imaging and dental records for a patient
   * @param {string} patientId
   * @returns {Promise<Array<Object>>}
   */
  async getRecords(patientId) {
    await delay(250);
    const records = getStorageItem(STORAGE_KEYS.RECORDS, []);
    return records.filter((r) => r.patientId === patientId);
  },

  /**
   * Retrieves brush streak data for a patient
   * @param {string} patientId
   * @returns {Promise<Object>}
   */
  async getBrushStreak(patientId) {
    await delay(150);
    const streaks = getStorageItem(STORAGE_KEYS.BRUSH_STREAK, {});
    return (
      streaks[patientId] || {
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        lastCheckInDate: null,
        history: {},
        unlockedBadges: [],
      }
    );
  },

  /**
   * Records a daily morning or night brush check-in
   * @param {string} patientId
   * @param {'morning'|'night'} period
   * @returns {Promise<Object>}
   */
  async recordBrushCheckIn(patientId, period = 'morning') {
    await delay(250);
    const streaks = getStorageItem(STORAGE_KEYS.BRUSH_STREAK, {});
    const today = new Date().toISOString().split('T')[0];

    const currentData = streaks[patientId] || {
      currentStreak: 0,
      longestStreak: 0,
      totalPoints: 0,
      lastCheckInDate: null,
      history: {},
      unlockedBadges: [],
    };

    const todayHistory = currentData.history[today] || { morning: false, night: false };

    if (todayHistory[period]) {
      return { ...currentData, alreadyChecked: true };
    }

    todayHistory[period] = true;
    currentData.history[today] = todayHistory;
    currentData.totalPoints += 25; // 25 Smile Points per check-in

    // Update streak if both morning and night or initial day check
    if (currentData.lastCheckInDate !== today) {
      currentData.currentStreak += 1;
      currentData.lastCheckInDate = today;
      if (currentData.currentStreak > currentData.longestStreak) {
        currentData.longestStreak = currentData.currentStreak;
      }
    }

    // Check badges
    const newBadges = [];
    if (currentData.currentStreak >= 3 && !currentData.unlockedBadges.includes('badge-3-days')) {
      currentData.unlockedBadges.push('badge-3-days');
      newBadges.push('3-Day Sparkle Streak');
    }
    if (currentData.currentStreak >= 7 && !currentData.unlockedBadges.includes('badge-7-days')) {
      currentData.unlockedBadges.push('badge-7-days');
      newBadges.push('7-Day Diamond Brushing');
    }
    if (currentData.currentStreak >= 30 && !currentData.unlockedBadges.includes('badge-30-days')) {
      currentData.unlockedBadges.push('badge-30-days');
      newBadges.push('30-Day Master of Oral Hygiene');
    }

    streaks[patientId] = currentData;
    setStorageItem(STORAGE_KEYS.BRUSH_STREAK, streaks);

    if (newBadges.length > 0) {
      await notificationService.create({
        userId: patientId,
        title: 'New Sparky Badge Unlocked!',
        message: `You just unlocked the "${newBadges.join(', ')}" badge! Keep up the brilliant smile routines.`,
        type: 'STREAK',
      });
    }

    return { ...currentData, newBadges };
  },
};
