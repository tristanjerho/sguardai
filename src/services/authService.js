import { initializeApp, deleteApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../config/firebase';
import { ROLES } from '../lib/roles';
import { activityLogService } from './activityLogService';

/**
 * Production Firebase Authentication & User Management Service
 * Single source of truth: Firebase Auth & Cloud Firestore
 */
export const authService = {
  /**
   * Logs in a user with real Firebase Authentication credentials
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} user document with role and profile
   */
  async login(email, password) {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please verify your environment configuration.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const uid = credential.user.uid;

    const userDocRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists()) {
      // Create basic profile if user document doesn't exist yet
      const initialProfile = {
        id: uid,
        uid: uid,
        email: normalizedEmail,
        fullName: credential.user.displayName || normalizedEmail.split('@')[0],
        role: ROLES.PATIENT,
        isOnboarded: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, initialProfile);
      return initialProfile;
    }

    const userData = { id: uid, uid, ...userSnapshot.data() };

    if (userData.deactivated) {
      await signOut(auth);
      throw new Error('This account has been deactivated. Please contact your clinic administrator.');
    }

    await activityLogService.log({
      userId: uid,
      actor: `${userData.fullName || userData.email} (${userData.role})`,
      action: 'USER_LOGIN',
      resourceType: 'SESSION',
      resourceId: uid,
      entity: `Authenticated session in ${userData.role} portal`,
    });

    return userData;
  },

  /**
   * Authenticates using real Firebase Google Sign-In with server-authoritative role lock.
   * If new user: strictly registers as PATIENT (staff cannot self-assign roles).
   * If existing user: loads authoritative role from Firestore.
   * @returns {Promise<Object>} user document with role and profile
   */
  async loginWithGoogle() {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please verify your environment configuration.');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let credential;
    try {
      credential = await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed before completing verification.');
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Browser popup was blocked. Please allow popups for this site.');
      } else if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Authentication Console (Sign-in method > Authorized domains).');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with this email using a different sign-in method.');
      } else if (err.code === 'auth/network-request-failed') {
        throw new Error('Network error during Google authentication. Check your internet connection.');
      }
      throw err;
    }

    const uid = credential.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists()) {
      // Strictly self-registers as PATIENT. Privileged staff roles can never be self-assigned.
      const initialProfile = {
        id: uid,
        uid: uid,
        email: credential.user.email ? credential.user.email.toLowerCase() : '',
        fullName: credential.user.displayName || credential.user.email?.split('@')[0] || 'Patient',
        role: ROLES.PATIENT, // Strictly PATIENT
        phone: credential.user.phoneNumber || '',
        dateOfBirth: '',
        medicalHistory: '',
        emergencyContact: '',
        isOnboarded: false,
        avatar: credential.user.photoURL || '',
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, initialProfile);

      await activityLogService.log({
        userId: uid,
        actor: `${initialProfile.fullName} (PATIENT)`,
        action: 'GOOGLE_AUTH_SIGNUP',
        resourceType: 'USER',
        resourceId: uid,
        entity: 'Registered new patient account via Google Authentication',
      });

      return initialProfile;
    }

    const userData = { id: uid, uid, ...userSnapshot.data() };

    if (userData.deactivated) {
      await signOut(auth);
      throw new Error('This account has been deactivated. Please contact your clinic administrator.');
    }

    await activityLogService.log({
      userId: uid,
      actor: `${userData.fullName || userData.email} (${userData.role})`,
      action: 'GOOGLE_AUTH_LOGIN',
      resourceType: 'SESSION',
      resourceId: uid,
      entity: `Authenticated session in ${userData.role} portal via Google`,
    });

    return userData;
  },

  /**
   * Registers a new user with real Firebase Auth and writes their Firestore profile
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.fullName
   * @param {string} [data.role]
   * @returns {Promise<Object>}
   */
  async signup({ email, password, fullName }) {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const uid = credential.user.uid;

    // Update Firebase Auth display name
    await updateFirebaseProfile(credential.user, {
      displayName: fullName.trim(),
    });

    // Server-Authoritative Role Provisioning:
    // Self-registration can ONLY create a PATIENT profile.
    // Staff roles (DENTIST, LAB_TECH, ADMIN, SUPERADMIN) are strictly administrator-provisioned.
    const newUserData = {
      id: uid,
      uid: uid,
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: ROLES.PATIENT,
      phone: '',
      dateOfBirth: '',
      medicalHistory: '',
      emergencyContact: '',
      isOnboarded: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', uid), newUserData);

    await activityLogService.log({
      userId: uid,
      actor: `${newUserData.fullName} (${newUserData.role})`,
      action: 'USER_SIGNUP',
      resourceType: 'USER',
      resourceId: uid,
      entity: 'Registered new user account in Firestore',
    });

    return newUserData;
  },

  /**
   * Fetches user profile from Firestore by UID
   * @param {string} uid
   * @returns {Promise<Object|null>}
   */
  async getUserProfile(uid) {
    if (!db || !uid) return null;
    const userDocRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userDocRef);
    if (!snapshot.exists()) return null;
    return { id: uid, uid, ...snapshot.data() };
  },

  /**
   * Completes patient onboarding flow in Firestore
   * @param {string} userId
   * @param {Object} onboardingData
   * @returns {Promise<Object>}
   */
  async completeOnboarding(userId, onboardingData) {
    if (!db) throw new Error('Firestore is not initialized.');

    const userDocRef = doc(db, 'users', userId);
    const updates = {
      fullName: onboardingData.fullName,
      phone: onboardingData.phone || '',
      dateOfBirth: onboardingData.dateOfBirth || '',
      medicalHistory: onboardingData.medicalHistory || '',
      emergencyContact: onboardingData.emergencyContact || '',
      isOnboarded: true,
      privacyConsent: {
        consented: true,
        timestamp: new Date().toISOString(),
        actReference: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
      },
      updatedAt: serverTimestamp(),
    };

    await updateDoc(userDocRef, updates);

    await activityLogService.log({
      userId,
      actor: `${onboardingData.fullName} (PATIENT)`,
      action: 'ONBOARDING_COMPLETED',
      resourceType: 'USER',
      resourceId: userId,
      entity: 'Completed clinical onboarding and accepted privacy consent',
    });

    const refreshed = await this.getUserProfile(userId);
    return refreshed;
  },

  /**
   * Updates user profile fields in Firestore
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, updates) {
    if (!db) throw new Error('Firestore is not initialized.');
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return this.getUserProfile(userId);
  },

  /**
   * Signs out the current Firebase session
   * @returns {Promise<void>}
   */
  async logout() {
    if (auth) {
      await signOut(auth);
    }
  },

  /**
   * Sends a real Firebase password reset email
   * @param {string} email
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    if (!auth) throw new Error('Firebase is not initialized.');
    await sendPasswordResetEmail(auth, email.trim());
  },

  /**
   * ADMIN: List all system users from Firestore
   * @returns {Promise<Array<Object>>}
   */
  async listUsers() {
    if (!db) throw new Error('Firestore is not initialized.');
    const querySnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    querySnapshot.forEach((d) => {
      users.push({ id: d.id, ...d.data() });
    });
    return users;
  },

  /**
   * ADMIN: Provision a new staff account profile in Firebase Auth and Firestore
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async createStaffUser(userData) {
    if (!db) throw new Error('Firestore is not initialized.');
    const normalizedEmail = userData.email.trim().toLowerCase();

    const existingSnap = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
    if (!existingSnap.empty) {
      throw new Error('An account with this email address already exists.');
    }

    const newStaffData = {
      email: normalizedEmail,
      fullName: userData.fullName.trim(),
      role: userData.role,
      specialty: userData.specialty || '',
      phone: userData.phone || '',
      department: userData.department || '',
      isOnboarded: true,
      deactivated: false,
      createdAt: serverTimestamp(),
    };

    let uid = null;

    // If password provided and firebaseConfig is available, provision in Firebase Auth
    if (userData.password && firebaseConfig?.apiKey) {
      const secondaryAppName = `StaffProvisioner_${Date.now()}`;
      let secondaryApp = null;
      try {
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth,
          normalizedEmail,
          userData.password
        );
        uid = userCred.user.uid;
        if (userData.fullName) {
          await updateFirebaseProfile(userCred.user, { displayName: userData.fullName.trim() });
        }
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          throw new Error('This email is already registered in Firebase Authentication.');
        } else if (authErr.code === 'auth/weak-password') {
          throw new Error('Password should be at least 6 characters.');
        } else {
          console.warn('Secondary auth provision warning:', authErr);
        }
      } finally {
        if (secondaryApp) {
          try {
            await deleteApp(secondaryApp);
          } catch (e) {
            console.error('Error deleting secondary app instance:', e);
          }
        }
      }
    }

    if (uid) {
      newStaffData.id = uid;
      newStaffData.uid = uid;
      await setDoc(doc(db, 'users', uid), newStaffData);
    } else {
      const docRef = await addDoc(collection(db, 'users'), newStaffData);
      uid = docRef.id;
      newStaffData.id = uid;
      newStaffData.uid = uid;
    }

    await activityLogService.log({
      action: 'CREATED_STAFF_ACCOUNT',
      resourceType: 'USER',
      resourceId: uid,
      entity: `Provisioned staff profile: ${userData.fullName} (${userData.role})`,
    });

    return { id: uid, ...newStaffData };
  },

  /**
   * ADMIN: Updates a user's role in Firestore
   * @param {string} userId
   * @param {string} newRole
   * @returns {Promise<void>}
   */
  async updateUserRole(userId, newRole) {
    if (!db) throw new Error('Firestore is not initialized.');
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      action: 'ROLE_CHANGED',
      resourceType: 'USER',
      resourceId: userId,
      entity: `Role changed to ${newRole}`,
    });
  },

  /**
   * ADMIN: Toggles active/deactivated state of a user account
   * @param {string} userId
   * @param {boolean} currentDeactivatedState
   * @returns {Promise<boolean>}
   */
  async toggleUserStatus(userId, currentDeactivatedState) {
    if (!db) throw new Error('Firestore is not initialized.');
    const newState = !currentDeactivatedState;
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      deactivated: newState,
      updatedAt: serverTimestamp(),
    });

    await activityLogService.log({
      action: newState ? 'DEACTIVATED_USER' : 'REACTIVATED_USER',
      resourceType: 'USER',
      resourceId: userId,
      entity: `User account status set to ${newState ? 'deactivated' : 'active'}`,
    });

    return newState;
  },

  /**
   * Realtime Firestore listener for all users
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToUsers(callback) {
    if (!db) {
      callback([]);
      return () => {};
    }
    const q = collection(db, 'users');
    return onSnapshot(
      q,
      (snapshot) => {
        const users = [];
        snapshot.forEach((d) => {
          users.push({ id: d.id, ...d.data() });
        });
        callback(users);
      },
      (err) => {
        console.error('Realtime users listener error:', err);
      }
    );
  },

  /**
   * Realtime Firestore listener for registered active clinic dentists
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToDentists(callback) {
    if (!db) {
      callback([]);
      return () => {};
    }
    const q = collection(db, 'users');
    return onSnapshot(
      q,
      (snapshot) => {
        const dentists = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const role = (data.role || '').toUpperCase();
          if (role === 'DENTIST' && !data.deactivated) {
            dentists.push({ id: d.id, ...data });
          }
        });
        callback(dentists);
      },
      (err) => {
        console.error('Realtime dentists listener error:', err);
      }
    );
  },

  /**
   * Ensures baseline clinical specialists exist in Firestore if the clinic has 0 registered dentists
   */
  async ensureDefaultDentists() {
    if (!db) return;
    try {
      const users = await this.listUsers();
      const existingDentists = users.filter((u) => (u.role || '').toUpperCase() === 'DENTIST');
      if (existingDentists.length === 0) {
        const defaultDentists = [
          {
            fullName: 'Dr. Maria Elena Santos, DMD',
            email: 'dr.santos@smileguard.ai',
            role: ROLES.DENTIST,
            specialty: 'Orthodontics & Dento-Facial Orthopedics',
            phone: '+63 917 555 0192',
            department: 'Orthodontics',
            isOnboarded: true,
            deactivated: false,
          },
          {
            fullName: 'Dr. Aris Rodriguez, DMD',
            email: 'dr.rodriguez@smileguard.ai',
            role: ROLES.DENTIST,
            specialty: 'Restorative & Endodontic Specialist',
            phone: '+63 918 555 0841',
            department: 'Endodontics',
            isOnboarded: true,
            deactivated: false,
          },
        ];
        for (const docData of defaultDentists) {
          await addDoc(collection(db, 'users'), {
            ...docData,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.warn('Error verifying default dentists:', err);
    }
  },
};
