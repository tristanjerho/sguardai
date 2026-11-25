import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCheck,
  Calendar,
  Activity,
  Sparkles,
  Info,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { notificationService } from '../../services/notificationService';
import { pushService } from '../../services/pushService';
import {
  getNotificationPermissionStatus,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  triggerDeviceNotification,
  NOTIF_PERMISSION_EVENT,
} from '../../lib/deviceNotifications';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatRelativeTime, formatDateTime } from '../../lib/formatters';

export function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermissionStatus());
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());
  const [enablingAlerts, setEnablingAlerts] = useState(false);

  useEffect(() => {
    const syncPerm = () => setNotifPermission(getNotificationPermissionStatus());
    window.addEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
    window.addEventListener('focus', syncPerm);
    return () => {
      window.removeEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
      window.removeEventListener('focus', syncPerm);
    };
  }, []);

  const handleEnablePhoneAlerts = async () => {
    const userId = user?.id || user?.uid;
    setEnablingAlerts(true);
    try {
      const { permission } = await pushService.enablePushNotifications(userId);
      setNotifPermission(permission);
      if (permission === 'granted') {
        toast.success('Phone & device notifications allowed!');
        await triggerDeviceNotification(
          'SmileGuard AI Alerts Enabled',
          'You will now receive instant appointment confirmations and reminders on this device.',
          { tag: 'patient-alerts-enabled', url: '/patient/notifications' }
        );
      } else if (permission === 'denied') {
        toast.error('Notifications are blocked. Open your phone browser site settings to allow Notifications.');
      }
    } finally {
      setEnablingAlerts(false);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
  };

  const handleTestPhoneAlert = async () => {
    if (notifPermission !== 'granted') {
      await handleEnablePhoneAlerts();
      return;
    }
    await triggerDeviceNotification(
      'SmileGuard AI Test Alert',
      'Notifications and alert sound are working on your device.',
      { tag: `patient-test-${Date.now()}`, url: '/patient/notifications' }
    );
  };

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = notificationService.subscribeForUser(userId, (list) => {
      setNotifications(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, user?.uid]);

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenNotification = (notif) => {
    setSelectedNotif(notif);
    if (!notif.read) {
      handleMarkAsRead(notif.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error('Failed to update notifications.');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    return n.type === filterType;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const tabs = [
    { id: 'ALL', label: 'All Alerts', badge: notifications.length },
    { id: 'APPOINTMENT', label: 'Appointments' },
    { id: 'TREATMENT', label: 'Treatment' },
    { id: 'CLINICAL', label: 'Clinical & Info' },
  ];

  const getIconForType = (type) => {
    switch (type) {
      case 'APPOINTMENT':
        return <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      case 'TREATMENT':
        return <Activity className="w-5 h-5 text-blue-500" />;
      case 'CLINICAL':
        return <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Info className="w-5 h-5 text-teal-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Notifications
          </h2>
          <p className="text-sm text-ink-secondary">
            Stay up to date with booking confirmations, appointment reminders, and clinical updates. Click any notification to view details.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            leftIcon={CheckCheck}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Phone & Device Notification Settings Card */}
      <Card className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-heading font-bold text-ink-primary">
              Phone &amp; Device Alerts:{' '}
              <span
                className={
                  notifPermission === 'granted'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : notifPermission === 'denied'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-teal-600 dark:text-teal-400'
                }
              >
                {notifPermission === 'granted'
                  ? 'Allowed'
                  : notifPermission === 'denied'
                    ? 'Blocked in Browser'
                    : notifPermission === 'unsupported'
                      ? 'Install App on Home Screen'
                      : 'Not Enabled Yet'}
              </span>
            </p>
            <p className="text-xs text-ink-secondary">
              {notifPermission === 'granted'
                ? 'Appointment confirmations and reminders will pop up on this device.'
                : notifPermission === 'denied'
                  ? 'Open your browser site settings and set Notifications to Allow, then reload.'
                  : 'Tap Allow Notifications so your phone can pop up appointment updates.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleSound}
            leftIcon={soundEnabled ? Volume2 : VolumeX}
          >
            {soundEnabled ? 'Sound On' : 'Muted'}
          </Button>

          {notifPermission === 'granted' ? (
            <Button type="button" variant="secondary" size="sm" onClick={handleTestPhoneAlert}>
              Test Alert
            </Button>
          ) : notifPermission === 'default' ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={BellRing}
              isLoading={enablingAlerts}
              onClick={handleEnablePhoneAlerts}
            >
              Allow Notifications
            </Button>
          ) : null}
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={filterType} onChange={setFilterType} />

      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="rectangular" className="h-20" count={4} />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          description="You're all caught up! There are no unread alerts at this time."
          icon={Bell}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => (
            <Card
              key={n.id}
              onClick={() => handleOpenNotification(n)}
              className={`p-4 sm:p-5 transition-all cursor-pointer hover:border-teal-400 hover:shadow-soft ${!n.read
                  ? 'border-teal-300 bg-teal-50/40 dark:bg-teal-950/20 shadow-soft-sm ring-1 ring-teal-400/20'
                  : 'opacity-90 hover:opacity-100'
                }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center flex-shrink-0 shadow-soft-sm">
                  {getIconForType(n.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                      <h3 className="font-heading font-bold text-sm text-ink-primary break-words">
                        {n.title}
                      </h3>
                      {!n.read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-muted whitespace-nowrap shrink-0">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed line-clamp-2 break-words">
                    {n.message}
                  </p>
                </div>

                <div className="text-ink-muted hover:text-teal-600 transition-colors p-1 shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pop-up Notification Detail Modal */}
      <Modal
        isOpen={!!selectedNotif}
        onClose={() => setSelectedNotif(null)}
        title="Notification Details"
        description="Detailed alert summary and related clinical portal shortcuts."
      >
        {selectedNotif && (
          <div className="space-y-5">
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/40">
              <div className="w-12 h-12 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center flex-shrink-0 shadow-soft">
                {getIconForType(selectedNotif.type)}
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                    {selectedNotif.type || 'NOTIFICATION'}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatDateTime(selectedNotif.createdAt)}
                  </span>
                </div>
                <h4 className="font-heading font-bold text-base text-ink-primary">
                  {selectedNotif.title}
                </h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-50 dark:bg-slate-900/40 border border-surface-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Full Notification Message
              </p>
              <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
                {selectedNotif.message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-surface-border">
              <span className="text-xs text-ink-muted">
                Received: {formatRelativeTime(selectedNotif.createdAt)}
              </span>

              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                {selectedNotif.type === 'APPOINTMENT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedNotif(null);
                      navigate('/patient/appointments');
                    }}
                    rightIcon={ArrowRight}
                  >
                    View Appointments
                  </Button>
                )}
                {selectedNotif.type === 'TREATMENT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedNotif(null);
                      navigate('/patient/treatment');
                    }}
                    rightIcon={ArrowRight}
                  >
                    View Treatment Plan
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNotif(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

