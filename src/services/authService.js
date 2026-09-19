import { getStorageItem, setStorageItem, STORAGE_KEYS, delay } from './mock/storage';
import { ROLES } from '../lib/roles';
import { activityLogService } from './activityLogService';

/**
 * Authentication & User Management Service (Mock layer)
 */
export const authService = {
  /**
   * Logs in a user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} user object
   */
  async login(email, password) {
    await delay(350);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const normalizedEmail = email.trim().toLowerCase();

    const user = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
    );

    if (!user) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    if (user.deactivated) {
      throw new Error('This account has been deactivated. Please contact the administrator.');
    }

    // Save session
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));

    await activityLogService.log({
      actor: `${user.fullName || user.email} (${user.role})`,
      action: 'USER_LOGIN',
      entity: `Logged into ${user.role.toLowerCase()} portal`,
    });

    return user;
  },

  /**
   * Mock Google OAuth Login
   * @returns {Promise<Object>}
   */
  async loginWithGoogle() {
    await delay(450);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    // Default to Maria Santos demo patient
    const user = users.find((u) => u.email === 'patient@demo.com') || users[0];

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));

    await activityLogService.log({
      actor: `${user.fullName} (${user.role})`,
      action: 'GOOGLE_AUTH_LOGIN',
      entity: 'Logged in via Google Single Sign-On (Mock)',
    });

    return user;
  },

  /**
   * Registers a new PATIENT user (Role is strictly locked to PATIENT)
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.fullName
   * @returns {Promise<Object>}
   */
  async signup({ email, password, fullName }) {
    await delay(400);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const normalizedEmail = email.trim().toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const newUser = {
      id: `usr-patient-${Date.now()}`,
      email: normalizedEmail,
      password,
      fullName: fullName.trim(),
      role: ROLES.PATIENT, // Strictly enforced: only PATIENT
      phone: '',
      dateOfBirth: '',
      medicalHistory: '',
      emergencyContact: '',
      isOnboarded: false, // Must complete onboarding
      privacyConsent: null,
      avatar: '',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    setStorageItem(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newUser));

    await activityLogService.log({
      actor: `${newUser.fullName} (PATIENT)`,
      action: 'USER_SIGNUP',
      entity: 'Created new patient account',
    });

    return newUser;
  },

  /**
   * Completes the required patient onboarding flow
   * @param {string} userId
   * @param {Object} onboardingData
   * @returns {Promise<Object>}
   */
  async completeOnboarding(userId, onboardingData) {
    await delay(350);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      throw new Error('User not found');
    }

    const updatedUser = {
      ...users[index],
      fullName: onboardingData.fullName || users[index].fullName,
      phone: onboardingData.phone,
      dateOfBirth: onboardingData.dateOfBirth,
      medicalHistory: onboardingData.medicalHistory,
      emergencyContact: onboardingData.emergencyContact,
      isOnboarded: true,
      privacyConsent: {
        consented: true,
        timestamp: new Date().toISOString(),
        actReference: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
      },
    };

    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedUser));

    await activityLogService.log({
      actor: `${updatedUser.fullName} (PATIENT)`,
      action: 'ONBOARDING_COMPLETED',
      entity: 'Accepted RA 10173 consent and provided clinical profile',
    });

    return updatedUser;
  },

  /**
   * Logs out current session
   * @returns {Promise<boolean>}
   */
  async logout() {
    await delay(150);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    return true;
  },

  /**
   * Restores active session user from localStorage
   * @returns {Object|null}
   */
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Updates profile information for the current user
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, updates) {
    await delay(300);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) throw new Error('User not found');

    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedUser));

    return updatedUser;
  },

  /**
   * Mock password reset request
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async requestPasswordReset(email) {
    await delay(350);
    return true;
  },

  /**
   * ADMIN: List all system users
   * @returns {Promise<Array<Object>>}
   */
  async listUsers() {
    await delay(250);
    return getStorageItem(STORAGE_KEYS.USERS, []);
  },

  /**
   * ADMIN: Create a new Staff Account (Dentist or Admin)
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async createStaffUser(userData) {
    await delay(350);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const normalizedEmail = userData.email.trim().toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser = {
      id: `usr-${userData.role.toLowerCase()}-${Date.now()}`,
      email: normalizedEmail,
      password: userData.password || 'Demo1234',
      fullName: userData.fullName.trim(),
      role: userData.role,
      specialty: userData.specialty || '',
      licenseNumber: userData.licenseNumber || '',
      department: userData.department || '',
      phone: userData.phone || '',
      isOnboarded: true,
      deactivated: false,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    setStorageItem(STORAGE_KEYS.USERS, users);

    await activityLogService.log({
      actor: 'Admin',
      action: 'CREATED_STAFF_ACCOUNT',
      entity: `${newUser.fullName} (${newUser.role})`,
    });

    return newUser;
  },

  /**
   * ADMIN: Updates user role
   * @param {string} userId
   * @param {string} newRole
   * @returns {Promise<Object>}
   */
  async updateUserRole(userId, newRole) {
    await delay(250);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');

    const oldRole = users[index].role;
    users[index].role = newRole;
    setStorageItem(STORAGE_KEYS.USERS, users);

    await activityLogService.log({
      actor: 'Admin',
      action: 'ROLE_CHANGED',
      entity: `${users[index].fullName}: ${oldRole} -> ${newRole}`,
    });

    return users[index];
  },

  /**
   * ADMIN: Toggle deactivation of an account
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async toggleUserStatus(userId) {
    await delay(250);
    const users = getStorageItem(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');

    users[index].deactivated = !users[index].deactivated;
    setStorageItem(STORAGE_KEYS.USERS, users);

    await activityLogService.log({
      actor: 'Admin',
      action: users[index].deactivated ? 'DEACTIVATED_USER' : 'REACTIVATED_USER',
      entity: `${users[index].fullName} (${users[index].email})`,
    });

    return users[index];
  },
};
