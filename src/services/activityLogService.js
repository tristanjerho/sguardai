import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';

/**
 * Service for managing auditable activity logs
 */
export const activityLogService = {
  /**
   * Retrieves all activity logs ordered by newest first
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    await delay(200);
    const logs = getStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
    return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  /**
   * Writes a new log entry
   * @param {Object} logData
   * @param {string} logData.actor
   * @param {string} logData.action
   * @param {string} logData.entity
   * @returns {Promise<Object>}
   */
  async log({ actor, action, entity }) {
    const logs = getStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
    const newLog = {
      id: `log-${Date.now()}`,
      actor: actor || 'System',
      action,
      entity,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    setStorageItem(STORAGE_KEYS.ACTIVITY_LOGS, logs);
    return newLog;
  },
};
