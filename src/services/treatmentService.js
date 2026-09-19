import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';
import { notificationService } from './notificationService';
import { activityLogService } from './activityLogService';

/**
 * Service for orthodontic and dental treatment plans
 */
export const treatmentService = {
  /**
   * Retrieves all treatment plans
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    await delay(250);
    return getStorageItem(STORAGE_KEYS.TREATMENTS, []);
  },

  /**
   * Retrieves treatment plan for a specific patient
   * @param {string} patientId
   * @returns {Promise<Object|null>}
   */
  async getByPatientId(patientId) {
    await delay(200);
    const treatments = getStorageItem(STORAGE_KEYS.TREATMENTS, []);
    return treatments.find((t) => t.patientId === patientId) || null;
  },

  /**
   * Updates stage, progress percentage, next adjustment date and clinical notes
   * @param {string} treatmentId
   * @param {Object} updates
   * @param {string} dentistName
   * @returns {Promise<Object>}
   */
  async update(treatmentId, updates, dentistName = 'Dr. Elena Gomez') {
    await delay(300);
    const treatments = getStorageItem(STORAGE_KEYS.TREATMENTS, []);
    const index = treatments.findIndex((t) => t.id === treatmentId);

    if (index === -1) throw new Error('Treatment plan not found');

    const current = treatments[index];
    const updated = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    treatments[index] = updated;
    setStorageItem(STORAGE_KEYS.TREATMENTS, treatments);

    // Notify patient of treatment stage changes
    await notificationService.create({
      userId: updated.patientId,
      title: 'Orthodontic Plan Updated',
      message: `${dentistName} updated your treatment progression (${updated.progressPercentage}% completed). Next adjustment is scheduled for ${updated.nextAdjustmentDate}.`,
      type: 'TREATMENT',
    });

    await activityLogService.log({
      actor: dentistName,
      action: 'UPDATED_TREATMENT_PLAN',
      entity: `Treatment #${treatmentId} for ${updated.patientName}`,
    });

    return updated;
  },
};
