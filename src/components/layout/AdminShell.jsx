import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { ROLES } from '../../lib/roles';

export function AdminShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/users')) return 'User Access & Staff Management';
    if (path.includes('/logs')) return 'Clinic Activity & Security Logs';
    return 'Admin Control Panel';
  };

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col">
      <Topbar
        title={getPageTitle()}
        showMenuButton={true}
        onMenuToggle={() => setIsSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role={ROLES.ADMIN}
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
