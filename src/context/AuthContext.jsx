import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on initial load
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
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
    if (!user) return null;
    const updated = await authService.completeOnboarding(user.id, onboardingData);
    setUser(updated);
    return updated;
  };

  const updateProfile = async (updates) => {
    if (!user) return null;
    const updated = await authService.updateProfile(user.id, updates);
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
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
