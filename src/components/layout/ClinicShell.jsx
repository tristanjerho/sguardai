import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { ROLES } from '../../lib/roles';
import { useAuth } from '../../hooks/useAuth';

export function ClinicShell() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/clinic') return 'Clinical Overview';
    if (path.includes('/queue')) return 'Appointments Queue';
    if (path.includes('/patients/')) return 'Patient Case File';
    if (path.includes('/patients')) return 'Patient Directory';
    if (path.includes('/treatments')) return 'Treatment Plans';
    if (path.includes('/lab-orders')) return 'Lab Orders';
    if (path.includes('/ai-workstation')) return 'AI Diagnostic Workstation';
    return 'Clinic Portal';
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-base text-ink-primary">
      <Topbar
        title={getPageTitle()}
        showMenuButton={true}
        onMenuToggle={() => setIsSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role={user?.role || ROLES.DENTIST}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
