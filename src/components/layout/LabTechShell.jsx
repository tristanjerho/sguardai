import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { ROLES } from '../../lib/roles';
import { LAB_ORDER_STATUS } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { notificationService } from '../../services/notificationService';
import {
  triggerDeviceNotification,
  requestNotificationPermission,
} from '../../lib/deviceNotifications';

export function LabTechShell() {
  const { user } = useAuth();
  const toast = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Real-time listener so Laboratory Admin immediately receives pop-up & sound/device alerts
  // the moment a Dentist submits or resubmits a lab prescription
  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;

    let previousOrderIds = null;
    let previousNotifIds = null;

    const unsubOrders = laboratoryService.subscribeToOrders((orders) => {
      if (previousOrderIds !== null) {
        const newlySubmitted = orders.filter(
          (o) => !previousOrderIds.has(o.id) && o.status === LAB_ORDER_STATUS.PENDING_REVIEW
        );

        newlySubmitted.forEach((ord) => {
          const rushPrefix = ord.priority === 'RUSH' ? '🚨 RUSH ' : '🧪 New ';
          const msg = `Dr. ${ord.dentistName || 'Dentist'} submitted ${ord.applianceType} (${ord.caseReference || 'New Case'}).`;
          toast.info(`${rushPrefix}Lab Request!\n${msg}`);
          triggerDeviceNotification(`${rushPrefix}Dentist Lab Request`, msg, {
            vibrate: [200, 100, 200],
          });
        });
      }

      previousOrderIds = new Set(orders.map((o) => o.id));
    }, user);

    const unsubNotifs = notificationService.subscribeForUser(userId, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);

      if (previousNotifIds !== null) {
        const newlyArrived = notifs.filter(
          (n) => !n.read && !previousNotifIds.has(n.id) && n.type !== 'LAB_ORDER'
        );
        newlyArrived.forEach((notif) => {
          toast.info(`${notif.title} — ${notif.message}`);
          triggerDeviceNotification(notif.title, notif.message);
        });
      }

      previousNotifIds = new Set(notifs.map((n) => n.id));
    });

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
    <div className="min-h-screen bg-surface-base text-ink-primary">
      <Topbar
        title={getPageTitle()}
        showMenuButton={true}
        onMenuToggle={() => setIsSidebarOpen(true)}
        unreadCount={unreadCount}
      />

      <Sidebar
        role={user?.role || ROLES.LAB_TECH}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="lg:pl-64 p-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:p-5 sm:pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:p-6 lg:pb-6 min-h-[calc(100vh-4rem)] transition-all overflow-x-hidden">
        <div className="w-full max-w-[1680px] mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomTabBar role={user?.role || ROLES.LAB_TECH} />
    </div>
  );
}
