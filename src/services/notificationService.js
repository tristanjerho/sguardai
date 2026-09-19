import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';

/**
 * Service for patient and staff notifications
 */
export const notificationService = {
  /**
   * Retrieves all notifications for a specific user
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  async listForUser(userId) {
    await delay(200);
    const notifs = getStorageItem(STORAGE_KEYS.NOTIFICATIONS, []);
    return notifs
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Gets the count of unread notifications for a user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    const notifs = getStorageItem(STORAGE_KEYS.NOTIFICATIONS, []);
    return notifs.filter((n) => n.userId === userId && !n.read).length;
  },

  /**
   * Marks a single notification as read
   * @param {string} notifId
   * @returns {Promise<Object>}
   */
  async markAsRead(notifId) {
    await delay(150);
    const notifs = getStorageItem(STORAGE_KEYS.NOTIFICATIONS, []);
    const index = notifs.findIndex((n) => n.id === notifId);
    if (index !== -1) {
      notifs[index].read = true;
      setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
      return notifs[index];
    }
    throw new Error('Notification not found');
  },

  /**
   * Marks all notifications as read for a given user
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async markAllAsRead(userId) {
    await delay(200);
    const notifs = getStorageItem(STORAGE_KEYS.NOTIFICATIONS, []);
    const updated = notifs.map((n) => (n.userId === userId ? { ...n, read: true } : n));
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    return true;
  },

  /**
   * Creates a notification for a user
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create({ userId, title, message, type = 'GENERAL' }) {
    const notifs = getStorageItem(STORAGE_KEYS.NOTIFICATIONS, []);
    const newNotif = {
      id: `notif-${Date.now()}`,
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifs.unshift(newNotif);
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
    return newNotif;
  },
};
