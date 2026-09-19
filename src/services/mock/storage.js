import {
  INITIAL_USERS,
  INITIAL_APPOINTMENTS,
  INITIAL_TREATMENTS,
  INITIAL_LAB_ORDERS,
  INITIAL_RECORDS,
  INITIAL_NOTIFICATIONS,
  INITIAL_BRUSH_STREAK,
  INITIAL_ACTIVITY_LOGS,
} from './seedData';

const STORAGE_KEYS = {
  USERS: 'sguardai_users',
  APPOINTMENTS: 'sguardai_appointments',
  TREATMENTS: 'sguardai_treatments',
  LAB_ORDERS: 'sguardai_lab_orders',
  RECORDS: 'sguardai_records',
  NOTIFICATIONS: 'sguardai_notifications',
  BRUSH_STREAK: 'sguardai_brush_streak',
  ACTIVITY_LOGS: 'sguardai_activity_logs',
  SESSION: 'sguardai_session_user',
};

/**
 * Initializes localStorage with seed data if not present.
 */
export function initializeStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TREATMENTS)) {
    localStorage.setItem(STORAGE_KEYS.TREATMENTS, JSON.stringify(INITIAL_TREATMENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LAB_ORDERS)) {
    localStorage.setItem(STORAGE_KEYS.LAB_ORDERS, JSON.stringify(INITIAL_LAB_ORDERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECORDS)) {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(INITIAL_RECORDS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BRUSH_STREAK)) {
    localStorage.setItem(STORAGE_KEYS.BRUSH_STREAK, JSON.stringify(INITIAL_BRUSH_STREAK));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(INITIAL_ACTIVITY_LOGS));
  }
}

/**
 * Helper to get data from localStorage
 */
export function getStorageItem(key, defaultValue = []) {
  initializeStorage();
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

/**
 * Helper to set data in localStorage
 */
export function setStorageItem(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

/**
 * Simulates async network delay (default 250ms - 400ms)
 */
export function delay(ms = 280) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { STORAGE_KEYS };
