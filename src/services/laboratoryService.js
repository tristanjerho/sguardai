import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';
import { LAB_ORDER_STATUS } from '../lib/constants';
import { activityLogService } from './activityLogService';

/**
 * Service for dental appliance laboratory orders
 */
export const laboratoryService = {
  /**
   * Retrieves all laboratory orders
   * @returns {Promise<Array<Object>>}
   */
  async list() {
    await delay(250);
    return getStorageItem(STORAGE_KEYS.LAB_ORDERS, []);
  },

  /**
   * Creates a new lab order
   * @param {Object} data
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async create(data, actorName = 'Dentist') {
    await delay(300);
    const orders = getStorageItem(STORAGE_KEYS.LAB_ORDERS, []);
    const newOrder = {
      id: `lab-${Date.now()}`,
      patientId: data.patientId,
      patientName: data.patientName,
      dentistId: data.dentistId,
      dentistName: data.dentistName || actorName,
      applianceType: data.applianceType,
      vendor: data.vendor,
      targetDeliveryDate: data.targetDeliveryDate,
      status: LAB_ORDER_STATUS.ORDERED,
      cost: data.cost || '₱3,500',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);
    setStorageItem(STORAGE_KEYS.LAB_ORDERS, orders);

    await activityLogService.log({
      actor: actorName,
      action: 'CREATED_LAB_ORDER',
      entity: `Lab Order for ${newOrder.applianceType} (${newOrder.patientName})`,
    });

    return newOrder;
  },

  /**
   * Updates status or details of a lab order
   * @param {string} orderId
   * @param {string} status
   * @param {string} actorName
   * @returns {Promise<Object>}
   */
  async updateStatus(orderId, status, actorName = 'Dentist') {
    await delay(250);
    const orders = getStorageItem(STORAGE_KEYS.LAB_ORDERS, []);
    const index = orders.findIndex((o) => o.id === orderId);

    if (index === -1) throw new Error('Lab order not found');

    orders[index].status = status;
    setStorageItem(STORAGE_KEYS.LAB_ORDERS, orders);

    await activityLogService.log({
      actor: actorName,
      action: 'UPDATED_LAB_ORDER_STATUS',
      entity: `Lab Order #${orderId} marked as ${status}`,
    });

    return orders[index];
  },
};
