import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ROLES } from '../../lib/roles';
import { LAB_ORDER_STATUS } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { notificationService } from '../../services/notificationService';
import { pushService } from '../../services/pushService';
import { triggerDeviceNotification } from '../../lib/deviceNotifications';

export function LabTechShell() {
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

  // Real-time listeners so Laboratory Staff receive instant computer & phone alerts
  // for BOTH new dentist lab prescriptions AND incoming dentist messages / clarifications / issues
  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;

    let previousOrderIds = null;
    let previousNotifIds = null;
    const recentlyAlertedOrderIds = new Set();

    const markOrderAlerted = (orderId) => {
      if (!orderId) return;
      recentlyAlertedOrderIds.add(orderId);
      setTimeout(() => recentlyAlertedOrderIds.delete(orderId), 8000);
    };

    // 1. Direct notifications listener: fires for ALL lab messages, clarifications, issues, and new orders
    const unsubNotifs = notificationService.subscribeForUser(userId, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);

      if (previousNotifIds !== null) {
        const newlyArrived = notifs.filter(
          (n) => !n.read && !previousNotifIds.has(n.id)
        );
        newlyArrived.forEach((notif) => {
          if (notif.type === 'LAB_ORDER' && notif.orderId) {
            if (recentlyAlertedOrderIds.has(notif.orderId)) return;
            markOrderAlerted(notif.orderId);
          }

          const targetUrl =
            notif.link || (notif.orderId ? `/lab/requests/${notif.orderId}` : '/lab');
          const isUrgent =
            notif.priority === 'HIGH' ||
            notif.type === 'LAB_MESSAGE' ||
            String(notif.title || '').includes('RUSH') ||
            String(notif.title || '').includes('Issue');

          toast.info(`${notif.title} — ${notif.message}`);
          triggerDeviceNotification(notif.title, notif.message, {
            tag: `lab-notif-${notif.id}`,
            url: targetUrl,
            urgent: isUrgent,
          });
        });
      }

      previousNotifIds = new Set(notifs.map((n) => n.id));
    });

    // 2. Live labOrders fallback listener (catches newly submitted orders even if direct notification lags)
    const unsubOrders = laboratoryService.subscribeToOrders((orders) => {
      if (previousOrderIds !== null) {
        const newlySubmitted = orders.filter(
          (o) => !previousOrderIds.has(o.id) && o.status === LAB_ORDER_STATUS.PENDING_REVIEW
        );

        newlySubmitted.forEach((ord) => {
          if (recentlyAlertedOrderIds.has(ord.id)) return;
          markOrderAlerted(ord.id);

          const isRush = ord.priority === 'RUSH';
          const rushPrefix = isRush ? '🚨 RUSH ' : '🧪 New ';
          const msg = `Dr. ${ord.dentistName || 'Dentist'} submitted ${ord.applianceType} (${ord.caseReference || 'New Case'}).`;
          toast.info(`${rushPrefix}Lab Request!\n${msg}`);
          triggerDeviceNotification(`${rushPrefix}Dentist Lab Request`, msg, {
            tag: `lab-order-${ord.id}`,
            url: `/lab/requests/${ord.id}`,
            urgent: isRush,
          });
        });
      }

      previousOrderIds = new Set(orders.map((o) => o.id));
    }, user);

    return () => {
      unsubOrders();
      unsubNotifs();
    };
  }, [user?.id, user?.uid]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/lab') return 'Laboratory Order Intake & Admin';
    if (path.includes('/board')) return 'Laboratory Production Board';
    if (path.includes('/requests/')) return 'Laboratory Request Details';
    return 'Dental Laboratory Portal';
  };

  return (
    <AppShell
      title={getPageTitle()}
      role={user?.role || ROLES.LAB_TECH}
      unreadCount={unreadCount}
      maxWidthClass="max-w-[1680px]"
    >
      <Outlet />
    </AppShell>
  );
}
