import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Service for managing immutable auditable activity logs in Cloud Firestore
 */
export const activityLogService = {
  /**
   * Retrieves audit logs ordered by newest first
   * @param {number} [maxCount=50]
   * @returns {Promise<Array<Object>>}
   */
  async list(maxCount = 50) {
    if (!db) return [];
    try {
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(maxCount)
      );
      const snapshot = await getDocs(q);
      const logs = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          ...data,
          timestamp: data.timestamp?.toDate
            ? data.timestamp.toDate().toISOString()
            : (data.timestamp || new Date().toISOString()),
        });
      });
      return logs;
    } catch (err) {
      console.warn('Audit logs query fallback (index pending or permission restriction):', err);
      // If composite index is provisioning, fallback to simple collection read
      try {
        const snapshot = await getDocs(collection(db, 'auditLogs'));
        const logs = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logs.push({
            id: docSnap.id,
            ...data,
            timestamp: data.timestamp?.toDate
              ? data.timestamp.toDate().toISOString()
              : (data.timestamp || new Date().toISOString()),
          });
        });
        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch (innerErr) {
        console.error('Failed to read audit logs:', innerErr);
        return [];
      }
    }
  },

  /**
   * Writes an immutable audit log entry to Firestore
   * @param {Object} logData
   * @param {string} [logData.userId]
   * @param {string} [logData.actor]
   * @param {string} logData.action
   * @param {string} [logData.resourceType]
   * @param {string} [logData.resourceId]
   * @param {string} [logData.entity]
   * @returns {Promise<Object>}
   */
  async log({ userId, actor, action, resourceType = 'SYSTEM', resourceId = '', entity = '' }) {
    if (!db) return null;
    try {
      const newEntry = {
        userId: userId || 'anonymous',
        actor: actor || 'Authenticated User',
        action,
        resourceType,
        resourceId,
        entity,
        timestamp: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'auditLogs'), newEntry);
      return { id: docRef.id, ...newEntry };
    } catch (err) {
      console.error('Audit log write error:', err);
      return null;
    }
  },
};
