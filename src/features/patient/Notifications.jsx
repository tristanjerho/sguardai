import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
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
              className={`p-4 sm:p-5 transition-all cursor-pointer hover:border-teal-400 hover:shadow-soft ${
                !n.read
                  ? 'border-teal-300 bg-teal-50/40 dark:bg-teal-950/20 shadow-soft-sm ring-1 ring-teal-400/20'
                  : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center flex-shrink-0 shadow-soft-sm">
                  {getIconForType(n.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-sm text-ink-primary">
                        {n.title}
                      </h3>
                      {!n.read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-muted whitespace-nowrap">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                </div>

                <div className="text-ink-muted hover:text-teal-600 transition-colors p-1">
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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-border">
              <span className="text-xs text-ink-muted">
                Received: {formatRelativeTime(selectedNotif.createdAt)}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
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

