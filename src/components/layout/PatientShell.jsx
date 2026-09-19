import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { ROLES } from '../../lib/roles';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';

export function PatientShell() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    async function loadNotifications() {
      if (user?.id) {
        try {
          const unread = await notificationService.getUnreadCount(user.id);
          setUnreadCount(unread);
        } catch (err) {
          console.error(err);
        }
      }
    }
    loadNotifications();
  }, [user?.id, location.pathname]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/patient') return 'Patient Dashboard';
    if (path.includes('/book')) return 'Book Appointment';
    if (path.includes('/appointments')) return 'My Appointments';
    if (path.includes('/treatment')) return 'Treatment Progress';
    if (path.includes('/records')) return 'Dental Records & Imaging';
    if (path.includes('/brush-streak')) return 'Oral Care & Streak';
    if (path.includes('/notifications')) return 'Notifications';
    if (path.includes('/profile')) return 'Profile & Settings';
    return 'Patient Portal';
  };

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col">
      <Topbar
        title={getPageTitle()}
        showMenuButton={true}
        onMenuToggle={() => setIsSidebarOpen(true)}
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role={ROLES.PATIENT}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomTabBar />
    </div>
  );
}
