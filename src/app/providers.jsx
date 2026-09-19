import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { MascotProvider } from '../context/MascotContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MascotProvider>{children}</MascotProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
