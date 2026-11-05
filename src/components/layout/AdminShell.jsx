import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROLES } from '../../lib/roles';
import { appointmentService } from '../../services/appointmentService';
import { notificationService } from '../../services/notificationService';
import { triggerDeviceNotification, requestNotificationPermission } from '../../lib/deviceNotifications';

export function AdminShell() {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;

    let previousApptIds = null;
    let previousNotifIds = null;

    const unsubAppts = appointmentService.subscribeToAppointments((appts) => {
      if (previousApptIds !== null) {
        const newlyCreated = appts.filter(
          (a) => !previousApptIds.has(a.id) && a.status === 'PENDING'
        );

        newlyCreated.forEach((apt) => {
          const procedure = apt.procedureName || apt.serviceName || 'Consultation';
          const alertMsg = `New booking request from ${apt.patientName} for ${procedure} on ${apt.date} at ${apt.timeSlot}.`;
          toast.info(`📅 New Booking Request!\n${alertMsg}`);
          triggerDeviceNotification('📅 New Patient Booking Request', alertMsg, {
            vibrate: [200, 100, 200],
          });
        });
      }

      previousApptIds = new Set(appts.map((a) => a.id));
    });

    const unsubNotifs = notificationService.subscribeForUser(userId, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);

      if (previousNotifIds !== null) {
        const newlyArrived = notifs.filter(
          (n) => !n.read && !previousNotifIds.has(n.id)
        );
        newlyArrived.forEach((notif) => {
          toast.info(`${notif.title} — ${notif.message}`);
          triggerDeviceNotification(notif.title, notif.message);
        });
      }

      previousNotifIds = new Set(notifs.map((n) => n.id));
    });

    return () => {
      unsubAppts();
      unsubNotifs();
    };
  }, [user?.id, user?.uid]);

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
        showMenuButton={false}
        unreadCount={unreadCount}
      />

      <div className="hidden lg:block">
        <Sidebar role={user?.role || ROLES.ADMIN} isOpen={false} />
      </div>

      <main className="lg:pl-64 p-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:p-8 lg:pb-8 min-h-[calc(100vh-4rem)] transition-all">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomTabBar role={user?.role || ROLES.ADMIN} />
    </div>
  );
}

