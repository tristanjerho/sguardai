import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LAB_ORDER_STATUS } from '../lib/constants';
import { activityLogService } from './activityLogService';

/**
 * Service for dental appliance laboratory orders in Cloud Firestore
 * Workflow: RECEIVED -> DESIGN -> MILLING -> GLAZING -> QA -> DISPATCHED
 */
export const laboratoryService = {
  /**
   * Retrieves all laboratory orders
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'labOrders'));
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
      console.error('Error fetching lab orders from Firestore:', err);
      throw err;
    }
  },

  /**
   * Creates a new lab order in Firestore
   * @param {Object} data
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async create(data, actorName = 'Dentist') {
    if (!db) throw new Error('Firestore is not initialized.');

    const newOrder = {
      patientId: data.patientId,
      patientName: data.patientName || 'Patient',
      dentistId: data.dentistId || '',
      dentistName: data.dentistName || actorName,
      applianceType: data.applianceType,
      vendor: data.vendor || 'In-House CAD/CAM Lab',
      toothNumbers: data.toothNumbers || [],
      shade: data.shade || 'A2',
      targetDeliveryDate: data.targetDeliveryDate || '',
      status: LAB_ORDER_STATUS.RECEIVED,
      cost: data.cost || '₱3,500',
      notes: data.notes || '',
      cadFileUrl: data.cadFileUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'labOrders'), newOrder);

    await activityLogService.log({
      actor: actorName,
      action: 'CREATED_LAB_ORDER',
      resourceType: 'LAB_ORDER',
      resourceId: docRef.id,
      entity: `Lab Order for ${newOrder.applianceType} (${newOrder.patientName})`,
    });

    return {
      id: docRef.id,
      ...newOrder,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Updates production status of a lab order in Firestore
   * @param {string} orderId
   * @param {string} status - e.g. RECEIVED, DESIGN, MILLING, GLAZING, QA, DISPATCHED
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async updateStatus(orderId, status, actorName = 'Lab Technician') {
    if (!db || !orderId) throw new Error('Firestore is not initialized.');

    const docRef = doc(db, 'labOrders', orderId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) throw new Error('Lab order not found');

    const updatePayload = {
      status,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updatePayload);

    await activityLogService.log({
      actor: actorName,
      action: 'UPDATED_LAB_ORDER_STATUS',
      resourceType: 'LAB_ORDER',
      resourceId: orderId,
      entity: `Lab Order #${orderId} marked as ${status}`,
    });

    return { id: orderId, ...existingSnap.data(), ...updatePayload };
  },
};
