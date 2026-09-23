import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';
import { authService } from '../services/authService';
import { ROLES } from '../lib/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await authService.getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            // Document creation in-flight or fallback for newly registered Firebase Auth user
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: ROLES.PATIENT,
              isOnboarded: false,
            });
          }
        } catch (err) {
          console.error('Error fetching Firestore user profile on auth state change:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const loggedInUser = await authService.loginWithGoogle();
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (data) => {
    setLoading(true);
    try {
      const newUser = await authService.signup(data);
      setUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (onboardingData) => {
    if (!user?.id) return null;
    const updated = await authService.completeOnboarding(user.id, onboardingData);
    setUser(updated);
    return updated;
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return null;
    const updated = await authService.updateProfile(user.id, updates);
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    role: user?.role || null,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    signup,
    completeOnboarding,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
