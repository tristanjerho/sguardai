import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../lib/roles';
import { isFirebaseConfigured } from '../config/firebase';

// Setup & Security
import { FirebaseSetupScreen } from '../components/common/FirebaseSetupScreen';
import { Unauthorized } from '../components/common/Unauthorized';

// Layouts
import { PatientShell } from '../components/layout/PatientShell';
import { ClinicShell } from '../components/layout/ClinicShell';
import { AdminShell } from '../components/layout/AdminShell';
import { LabTechShell } from '../components/layout/LabTechShell';

// Auth Pages
import { Login } from '../features/auth/Login';
import { Signup } from '../features/auth/Signup';
import { ForgotPassword } from '../features/auth/ForgotPassword';
import { Onboarding } from '../features/auth/Onboarding';

// Patient Pages
import { PatientDashboard } from '../features/patient/Dashboard';
import { BookAppointment } from '../features/patient/BookAppointment';
import { MyAppointments } from '../features/patient/MyAppointments';
import { TreatmentProgress } from '../features/patient/TreatmentProgress';
import { Records } from '../features/patient/Records';
import { BrushStreak } from '../features/patient/BrushStreak';
import { Notifications } from '../features/patient/Notifications';
import { PatientProfile } from '../features/patient/Profile';

// Clinic Pages
import { ClinicDashboard } from '../features/clinic/Dashboard';
import { AppointmentsQueue } from '../features/clinic/AppointmentsQueue';
import { PatientsDirectory } from '../features/clinic/Patients';
import { PatientDetail } from '../features/clinic/PatientDetail';
import { TreatmentsManager } from '../features/clinic/Treatments';
import { LabOrdersManager } from '../features/clinic/LabOrders';
import { AiWorkstation } from '../features/clinic/AiWorkstation';

// Lab Pages
import { LabOrdersQueue } from '../features/lab/LabOrdersQueue';

// Admin Pages
import { SuperAdminDashboard } from '../features/admin/SuperAdminDashboard';
import { UserManagement } from '../features/admin/UserManagement';
import { ActivityLogs } from '../features/admin/ActivityLogs';

// Landing Page
import { LandingPage } from '../features/landing/LandingPage';

/**
 * Route protection guard enforcing authentication, role boundaries, and onboarding completion
 */
export function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-heading font-semibold text-teal-700 dark:text-teal-400">
            Verifying secure credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Patient onboarding gate
  if (user.role === ROLES.PATIENT && !user.isOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Role authorization check - redirects to /unauthorized if role is not permitted
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export function PublicAuthRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated && user) {
    if (user.role === ROLES.PATIENT) {
      return <Navigate to={user.isOnboarded ? '/patient' : '/onboarding'} replace />;
    }
    if (user.role === ROLES.DENTIST) return <Navigate to="/clinic" replace />;
    if (user.role === ROLES.LAB_TECH) return <Navigate to="/lab" replace />;
    if (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN) return <Navigate to="/admin" replace />;
  }

  return children;
}

function AdminIndexRedirect() {
  const { user } = useAuth();
  if (user?.role === ROLES.SUPERADMIN) {
    return <Navigate to="/admin/super" replace />;
  }
  return <Navigate to="/admin/users" replace />;
}

export function AppRoutes() {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupScreen />;
  }

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicAuthRoute>
            <Login />
          </PublicAuthRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicAuthRoute>
            <Signup />
          </PublicAuthRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Security Boundaries */}
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Patient Onboarding Route */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowedRoles={[ROLES.PATIENT]}>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Patient Portal Routes */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={[ROLES.PATIENT]}>
            <PatientShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<PatientDashboard />} />
        <Route path="book" element={<BookAppointment />} />
        <Route path="appointments" element={<MyAppointments />} />
        <Route path="treatment" element={<TreatmentProgress />} />
        <Route path="records" element={<Records />} />
        <Route path="brush-streak" element={<BrushStreak />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>

      {/* Clinic Portal Routes (DENTIST, ADMIN, SUPERADMIN) */}
      <Route
        path="/clinic"
        element={
          <ProtectedRoute allowedRoles={[ROLES.DENTIST, ROLES.ADMIN, ROLES.SUPERADMIN]}>
            <ClinicShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClinicDashboard />} />
        <Route path="queue" element={<AppointmentsQueue />} />
        <Route path="patients" element={<PatientsDirectory />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="treatments" element={<TreatmentsManager />} />
        <Route path="lab-orders" element={<LabOrdersManager />} />
        <Route path="ai-workstation" element={<AiWorkstation />} />
      </Route>

      {/* Lab Technician Portal Routes (LAB_TECH, SUPERADMIN) */}
      <Route
        path="/lab"
        element={
          <ProtectedRoute allowedRoles={[ROLES.LAB_TECH, ROLES.SUPERADMIN]}>
            <LabTechShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<LabOrdersQueue />} />
        <Route path="orders" element={<LabOrdersQueue />} />
      </Route>

      {/* Admin Portal Routes (ADMIN, SUPERADMIN) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminIndexRedirect />} />
        <Route
          path="super"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.ADMIN]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="users" element={<UserManagement />} />
        <Route path="logs" element={<ActivityLogs />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
