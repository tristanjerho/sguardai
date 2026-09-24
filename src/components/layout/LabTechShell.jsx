import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { ROLES } from '../../lib/roles';
import { useAuth } from '../../hooks/useAuth';

export function LabTechShell() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/lab') return 'Digital Lab Production Pipeline';
    if (path.includes('/orders')) return 'All Laboratory Work Orders';
    return 'Dental Laboratory';
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
          role={user?.role || ROLES.LAB_TECH}
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
