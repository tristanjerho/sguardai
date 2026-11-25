import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ROLES } from '../../lib/roles';
import { notificationService } from '../../services/notificationService';
import { pushService } from '../../services/pushService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { triggerDeviceNotification } from '../../lib/deviceNotifications';

export function PatientShell() {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;
    pushService.syncPushToken(userId);
  }, [user?.id, user?.uid]);

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;

    let previousIds = null;

    const unsubscribe = notificationService.subscribeForUser(userId, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);

      // Check for newly arrived unread notifications and pop up a live toast & mobile alert
      if (previousIds !== null) {
        const newlyArrived = notifs.filter(
          (n) => !n.read && !previousIds.has(n.id)
        );
        newlyArrived.forEach((notif) => {
          if (notif.title?.includes('Confirmed') || notif.title?.includes('Accepted')) {
            toast.success(`${notif.title} — ${notif.message}`);
          } else {
            toast.info(`${notif.title} — ${notif.message}`);
          }
          triggerDeviceNotification(notif.title, notif.message, {
            tag: `patient-notif-${notif.id}`,
            url: notif.link || '/patient/notifications',
          });
        });
      }

      previousIds = new Set(notifs.map((n) => n.id));
    });

    return () => unsubscribe();
  }, [user?.id, user?.uid]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/patient') return 'Patient Dashboard';
    if (path.includes('/book')) return 'Book Appointment';
    if (path.includes('/appointments')) return 'My Appointments';
    if (path.includes('/treatment')) return 'Treatment Progress';
    if (path.includes('/records')) return 'Dental Records & Imaging';
    if (path.includes('/notifications')) return 'Notifications';
    if (path.includes('/profile')) return 'Profile & Settings';
    return 'Patient Portal';
  };

  return (
    <AppShell
      title={getPageTitle()}
      role={ROLES.PATIENT}
      unreadCount={unreadCount}
      maxWidthClass="max-w-6xl"
    >
      <Outlet />
    </AppShell>
  );
}
