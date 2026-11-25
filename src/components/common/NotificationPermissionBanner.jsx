import React, { useState, useEffect } from 'react';
import { BellRing, Smartphone, Share, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { pushService } from '../../services/pushService';
import {
  getNotificationPermissionStatus,
  isIosBrowserNeedingPwaInstall,
  triggerDeviceNotification,
  NOTIF_PERMISSION_EVENT,
} from '../../lib/deviceNotifications';
import { ROLES } from '../../lib/roles';

const DISMISS_KEY = 'smileguard_notif_banner_dismissed_at';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Mobile & Desktop Notification Permission Banner.
 * Gives phone users (Android Chrome, iOS PWA, Desktop) an explicit one-tap prompt
 * inside the app to allow native device notifications, since mobile browsers block
 * automatic permission requests without a user tap gesture.
 */
export function NotificationPermissionBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [permission, setPermission] = useState(() => getNotificationPermissionStatus());
  const [needsIosInstall] = useState(() => isIosBrowserNeedingPwaInstall());
  const [enabling, setEnabling] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const ts = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      return ts > 0 && Date.now() - ts < DISMISS_DURATION_MS;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncPerm = () => setPermission(getNotificationPermissionStatus());
    window.addEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
    window.addEventListener('focus', syncPerm);
    return () => {
      window.removeEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
      window.removeEventListener('focus', syncPerm);
    };
  }, []);

  const userId = user?.id || user?.uid;

  // Hide once granted, dismissed, or if browser doesn't support notifications (and isn't iOS Safari)
  if (!userId || dismissed || permission === 'granted') {
    return null;
  }
  if (permission === 'unsupported' && !needsIosInstall) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage error
    }
  };

  const handleAllowClick = async () => {
    setEnabling(true);
    try {
      const { permission: result, fcmRegistered } =
        await pushService.enablePushNotifications(userId);
      setPermission(result);

      if (result === 'granted') {
        toast.success(
          fcmRegistered
            ? 'Phone & computer notifications allowed (with background push)!'
            : 'Phone & computer notifications allowed on this device!'
        );
        const homeUrl =
          user?.role === ROLES.LAB_TECH
            ? '/lab'
            : user?.role === ROLES.PATIENT
              ? '/patient/notifications'
              : '/clinic/queue';
        await triggerDeviceNotification(
          'SmileGuard AI Alerts Enabled',
          'Notifications are now allowed on your device.',
          { tag: 'smileguard-alerts-enabled', url: homeUrl }
        );
      } else if (result === 'denied') {
        toast.error(
          'Notifications were blocked. Open your phone browser site settings to allow Notifications.'
        );
      }
    } finally {
      setEnabling(false);
    }
  };

  const roleContextText =
    user?.role === ROLES.LAB_TECH
      ? 'new dentist lab orders, messages, and urgent RUSH alerts'
      : user?.role === ROLES.PATIENT
        ? 'appointment confirmations, schedule updates, and reminders'
        : 'new patient bookings and laboratory messages';

  return (
    <div className="mb-4 rounded-2xl border border-teal-500/30 bg-teal-50/80 dark:bg-teal-950/35 dark:border-teal-500/30 px-3.5 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-teal-600/15 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
          {needsIosInstall ? (
            <Smartphone className="w-4 h-4" />
          ) : permission === 'denied' ? (
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <BellRing className="w-4 h-4" />
          )}
        </div>

        <div className="min-w-0 text-xs">
          {needsIosInstall ? (
            <>
              <p className="font-heading font-bold text-ink-primary">
                Enable iPhone / iPad Notifications
              </p>
              <p className="text-ink-secondary mt-0.5 leading-relaxed">
                Tap <Share className="w-3.5 h-3.5 inline-block mx-0.5 -mt-0.5 text-teal-600" />
                <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open SmileGuard
                from your Home Screen to allow phone alerts for {roleContextText}.
              </p>
            </>
          ) : permission === 'denied' ? (
            <>
              <p className="font-heading font-bold text-ink-primary">
                Phone / Browser Notifications Are Blocked
              </p>
              <p className="text-ink-secondary mt-0.5 leading-relaxed">
                Tap the <strong>site settings / lock icon</strong> in your browser address bar, set{' '}
                <strong>Notifications → Allow</strong>, and refresh to receive {roleContextText}.
              </p>
            </>
          ) : (
            <>
              <p className="font-heading font-bold text-ink-primary">
                Allow Notifications on This Device
              </p>
              <p className="text-ink-secondary mt-0.5 leading-relaxed">
                Tap <strong>Allow Notifications</strong> to receive instant phone &amp; desktop
                alerts for {roleContextText}.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {!needsIosInstall && permission === 'default' && (
          <button
            type="button"
            disabled={enabling}
            onClick={handleAllowClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
          >
            <BellRing className="w-3.5 h-3.5" />
            {enabling ? 'Requesting...' : 'Allow Notifications'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100/80 dark:hover:bg-surface-800/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
