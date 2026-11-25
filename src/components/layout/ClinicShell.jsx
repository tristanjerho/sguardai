import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ROLES } from '../../lib/roles';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { notificationService } from '../../services/notificationService';
import { pushService } from '../../services/pushService';
import { triggerDeviceNotification } from '../../lib/deviceNotifications';

export function ClinicShell() {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  // Sync background FCM push token if permission is already granted
  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;
    pushService.syncPushToken(userId);
  }, [user?.id, user?.uid]);

  // Real-time listeners for incoming patient bookings & laboratory messages/updates
  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;

    let previousApptIds = null;
    let previousNotifIds = null;
    const recentlyAlertedApptIds = new Set();

    const markApptAlerted = (apptId) => {
      if (!apptId) return;
      recentlyAlertedApptIds.add(apptId);
      setTimeout(() => recentlyAlertedApptIds.delete(apptId), 8000);
    };

    // 1. Real-time appointments listener for instant booking pop-ups on dentist computer/phone
    const unsubAppts = appointmentService.subscribeToAppointments((appts) => {
      if (previousApptIds !== null) {
        const newlyCreated = appts.filter(
          (a) => !previousApptIds.has(a.id) && a.status === 'PENDING'
        );

        newlyCreated.forEach((apt) => {
          const isAssigned = !apt.dentistId || apt.dentistId === userId;
          const isClinicWatcher =
            isAssigned ||
            user.role === ROLES.RECEPTIONIST ||
            user.role === ROLES.ADMIN ||
            user.role === ROLES.SUPERADMIN;

          if (isClinicWatcher && !recentlyAlertedApptIds.has(apt.id)) {
            markApptAlerted(apt.id);
            const procedure = apt.procedureName || apt.serviceName || 'Consultation';
            const alertMsg = `New booking request from ${apt.patientName} for ${procedure} on ${apt.date} at ${apt.timeSlot}.`;
            toast.info(`📅 New Booking Request!\n${alertMsg}`);
            triggerDeviceNotification('📅 New Patient Booking Request', alertMsg, {
              tag: `clinic-booking-${apt.id}`,
              url: '/clinic/queue',
              urgent: true,
            });
          }
        });
      }

      previousApptIds = new Set(appts.map((a) => a.id));
    });

    // 2. Real-time direct notifications listener for dentist (Lab messages, status updates, bookings)
    const unsubNotifs = notificationService.subscribeForUser(userId, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);

      if (previousNotifIds !== null) {
        const newlyArrived = notifs.filter(
          (n) => !n.read && !previousNotifIds.has(n.id)
        );
        newlyArrived.forEach((notif) => {
          // Avoid double-alerting the same new booking if unsubAppts already alerted it
          if (notif.type === 'APPOINTMENT' && notif.appointmentId) {
            if (recentlyAlertedApptIds.has(notif.appointmentId)) return;
            markApptAlerted(notif.appointmentId);
          }

          const targetUrl =
            notif.link ||
            (notif.type === 'APPOINTMENT'
              ? '/clinic/queue'
              : notif.orderId
                ? `/clinic/lab-orders/${notif.orderId}`
                : '/clinic/lab-orders');
          const isUrgent =
            notif.priority === 'HIGH' ||
            notif.type === 'LAB_MESSAGE' ||
            notif.type === 'APPOINTMENT';

          toast.info(`${notif.title} — ${notif.message}`);
          triggerDeviceNotification(notif.title, notif.message, {
            tag: `clinic-notif-${notif.id}`,
            url: targetUrl,
            urgent: isUrgent,
          });
        });
      }

      previousNotifIds = new Set(notifs.map((n) => n.id));
    });

    return () => {
      unsubAppts();
      unsubNotifs();
    };
  }, [user?.id, user?.uid, user?.role]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/clinic') return 'Clinical Overview';
    if (path.includes('/queue')) return 'Appointments Queue';
    if (path.includes('/patients/')) return 'Patient Case File';
    if (path.includes('/patients')) return 'Patient Directory';
    if (path.includes('/archive')) return 'Patient Archive';
    if (path.includes('/treatments')) return 'Treatment Plans';
    if (path.includes('/lab-orders/')) return 'Laboratory Request Details';
    if (path.includes('/lab-orders')) return 'Dental Laboratory Prescriptions';
    if (path.includes('/ai-workstation')) return 'AI Diagnostic Workstation';
    return 'Clinic Portal';
  };

  return (
    <AppShell
      title={getPageTitle()}
      role={user?.role || ROLES.DENTIST}
      unreadCount={unreadCount}
      maxWidthClass="max-w-7xl"
    >
      <Outlet />
    </AppShell>
  );
}
