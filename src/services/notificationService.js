import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Service for patient and staff notifications in Cloud Firestore
 */
export const notificationService = {
  /**
   * Retrieves all notifications for a specific user from Firestore
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  async listForUser(userId) {
    if (!db || !userId) return [];
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));
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
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('Error fetching notifications from Firestore:', err);
      return [];
    }
  },

  /**
   * Gets the count of unread notifications for a user
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    const notifs = await this.listForUser(userId);
    return notifs.filter((n) => !n.read).length;
  },

  /**
   * Marks a single notification as read
   * @param {string} notifId
   * @returns {Promise<void>}
   */
  async markAsRead(notifId) {
    if (!db || !notifId) return;
    const docRef = doc(db, 'notifications', notifId);
    await updateDoc(docRef, { read: true, updatedAt: serverTimestamp() });
  },

  /**
   * Marks all notifications as read for a given user
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async markAllAsRead(userId) {
    if (!db || !userId) return true;
    const notifs = await this.listForUser(userId);
    const unread = notifs.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true, updatedAt: serverTimestamp() }))
    );
    return true;
  },

  /**
   * Creates a notification for a user in Firestore
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create({ userId, title, message, type = 'GENERAL' }) {
    if (!db || !userId) return null;
    const newNotif = {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'notifications'), newNotif);
    return { id: docRef.id, ...newNotif, createdAt: new Date().toISOString() };
  },
};
