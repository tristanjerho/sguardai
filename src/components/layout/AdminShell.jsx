import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';

export function AdminShell() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/super')) return 'SuperAdmin Command Center';
    if (path.includes('/users')) return 'User Access & Staff Management';
    if (path.includes('/logs')) return 'Clinic Activity & Security Logs';
    return 'Admin Control Panel';
  };

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary">
      <Topbar
        title={getPageTitle()}
        showMenuButton={true}
        onMenuToggle={() => setIsSidebarOpen(true)}
      />

      <Sidebar
        role={user?.role || ROLES.ADMIN}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="lg:pl-64 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] transition-all">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
