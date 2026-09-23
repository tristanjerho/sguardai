import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  Flame,
  Activity,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { notificationService } from '../../services/notificationService';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatRelativeTime } from '../../lib/formatters';

export function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

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
    { id: 'STREAK', label: 'Streaks & Badges' },
  ];

  const getIconForType = (type) => {
    switch (type) {
      case 'APPOINTMENT':
        return <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
      case 'STREAK':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'TREATMENT':
        return <Activity className="w-5 h-5 text-blue-500" />;
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
            Stay up to date with booking confirmations, milestone cheers, and clinical updates.
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
              onClick={() => !n.read && handleMarkAsRead(n.id)}
              className={`p-4 sm:p-5 transition-all cursor-pointer ${
                !n.read
                  ? 'border-teal-300 bg-teal-50/40 dark:bg-teal-950/20 shadow-soft-sm'
                  : 'opacity-85'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center flex-shrink-0 shadow-soft-sm">
                  {getIconForType(n.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-sm text-ink-primary">
                      {n.title}
                    </h3>
                    <span className="text-[11px] text-ink-muted whitespace-nowrap">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
                    {n.message}
                  </p>
                </div>

                {!n.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 mt-2" title="Unread" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
