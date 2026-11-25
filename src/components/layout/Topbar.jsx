import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  LogOut,
  User,
  Shield,
  Smile,
  Menu,
  CheckCheck,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useMascot } from '../../context/MascotContext';
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
import { formatRelativeTime, dedupeDoctorPrefix } from '../../lib/formatters';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../common/Logo';
import { ROLES, ROLE_LABELS } from '../../lib/roles';

export function Topbar({
  title,
  onMenuToggle,
  showMenuButton = false,
  isMobileMenuOpen = false,
  unreadCount = 0,
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showSparky, toggleSparky } = useMascot();
  const toast = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [staffNotifs, setStaffNotifs] = useState([]);
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermissionStatus());
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());
  const [enablingPush, setEnablingPush] = useState(false);
  const navigate = useNavigate();

  const isPatient = user?.role === ROLES.PATIENT;
  const userId = user?.id || user?.uid;

  const portalHome =
    user?.role === ROLES.PATIENT
      ? '/patient'
      : user?.role === ROLES.LAB_TECH
        ? '/lab'
        : user?.role === ROLES.SUPERADMIN
          ? '/admin/super'
          : user?.role === ROLES.ADMIN
            ? '/admin/users'
            : user?.role === ROLES.DENTIST || user?.role === ROLES.RECEPTIONIST
              ? '/clinic'
              : '/';

  useEffect(() => {
    const syncPerm = () => setNotifPermission(getNotificationPermissionStatus());
    window.addEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
    window.addEventListener('focus', syncPerm);
    return () => {
      window.removeEventListener(NOTIF_PERMISSION_EVENT, syncPerm);
      window.removeEventListener('focus', syncPerm);
    };
  }, []);

  useEffect(() => {
    if (!userId || isPatient) return;
    const unsub = notificationService.subscribeForUser(userId, (items) => {
      setStaffNotifs(items.slice(0, 12));
    });
    return () => unsub();
  }, [userId, isPatient]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await notificationService.markAllAsRead(userId);
  };

  const handleEnableDeviceAlerts = async () => {
    setEnablingPush(true);
    try {
      const { permission, fcmRegistered } = await pushService.enablePushNotifications(userId);
      setNotifPermission(permission);
      if (permission === 'granted') {
        toast.success(
          fcmRegistered
            ? 'Computer & phone alerts enabled (including background push)!'
            : 'Computer & phone alerts enabled for this device!'
        );
        await triggerDeviceNotification(
          'SmileGuard AI Alerts Enabled',
          'You will now receive instant alerts for messages, lab updates, and bookings.',
          { tag: 'smileguard-alerts-enabled' }
        );
      } else if (permission === 'denied') {
        toast.error('Notifications are blocked in your browser settings. Please allow notifications for this site.');
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
  };

  const handleTestAlert = async () => {
    if (notifPermission !== 'granted') {
      await handleEnableDeviceAlerts();
      return;
    }
    await triggerDeviceNotification(
      'SmileGuard AI Test Alert',
      'Live device notifications and sound chime are working on this device.',
      {
        tag: `smileguard-test-${Date.now()}`,
        url: user?.role === ROLES.LAB_TECH ? '/lab' : '/clinic/queue',
      }
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border dark:border-[#26415E]/80 bg-surface-card/90 dark:bg-[#0B1B32]/90 backdrop-blur-xl px-2.5 xs:px-4 sm:px-6 flex items-center justify-between gap-2 transition-colors shadow-xs pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))]">
      <div className="flex items-center gap-1.5 xs:gap-2.5 sm:gap-3 min-w-0 flex-1">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-1.5 xs:p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:bg-surface-100 dark:hover:bg-[#26415E]/60 md:hidden shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <Logo size="md" to={portalHome} iconClassName="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10" />

          {title && (
            <>
              <span className="hidden sm:inline-block text-surface-300 dark:text-[#26415E] font-light shrink-0">/</span>
              <h1 className="hidden sm:inline-block text-sm font-heading font-semibold text-ink-secondary dark:text-[#E5C9D7] truncate max-w-[140px] md:max-w-[220px] lg:max-w-xs">
                {title}
              </h1>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 xs:gap-1.5 sm:gap-2.5 shrink-0">
        {/* Gardy Mascot toggle for patients only (mobile patients toggle via profile dropdown) */}
        {isPatient && (
          <button
            type="button"
            onClick={toggleSparky}
            title={showSparky ? 'Hide Gardy Mascot' : 'Show Gardy Mascot'}
            className={`hidden md:flex p-2 rounded-xl text-xs font-semibold items-center gap-1.5 transition-all ${showSparky
                ? 'bg-teal-50 text-teal-700 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] border border-teal-200 dark:border-[#83A6CE]/30'
                : 'text-ink-muted dark:text-[#83A6CE] hover:bg-surface-100 dark:hover:bg-[#26415E]/60'
              }`}
            aria-label="Toggle Gardy Mascot"
          >
            <Smile className="w-4 h-4 text-teal-600 dark:text-[#C48CB3]" />
            <span className="hidden md:inline">Gardy</span>
          </button>
        )}

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 xs:p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-[#E5C9D7] drop-shadow-[0_0_8px_rgba(229,201,215,0.6)]" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Notifications Icon (Patient links to /patient/notifications; Staff opens live popover) */}
        {isPatient ? (
          <Link
            to="/patient/notifications"
            className="relative p-1.5 xs:p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#C48CB3] rounded-full ring-2 ring-surface-card dark:ring-[#0B1B32] animate-pulse" />
            )}
          </Link>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifPopover(!showNotifPopover);
                setShowDropdown(false);
              }}
              className="relative p-1.5 xs:p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
              aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold bg-rose-500 text-white rounded-full flex items-center justify-center ring-2 ring-surface-card dark:ring-[#0B1B32]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifPopover && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifPopover(false)}
                />
                <div className="fixed sm:absolute right-2 sm:right-0 top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)] sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-h-[calc(100dvh-5.5rem)] flex flex-col rounded-2xl bg-surface-card dark:bg-[#0D1E4C]/95 dark:backdrop-blur-xl border border-surface-border dark:border-[#26415E] shadow-soft-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-border dark:border-[#26415E] flex items-center justify-between gap-2 shrink-0">
                    <p className="text-xs font-heading font-extrabold uppercase tracking-wider text-ink-primary dark:text-[#F8FAFC] truncate">
                      Live Clinical &amp; Lab Alerts
                    </p>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-teal-600 dark:text-[#E5C9D7] hover:underline flex items-center gap-1 shrink-0"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Computer & Phone Alert Controls */}
                  <div className="px-4 py-2.5 border-b border-surface-border/70 dark:border-[#26415E]/70 bg-surface-50/70 dark:bg-[#0B1B32]/70 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <BellRing
                        className={`w-3.5 h-3.5 shrink-0 ${
                          notifPermission === 'granted'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : notifPermission === 'denied'
                              ? 'text-amber-500'
                              : 'text-teal-600 dark:text-teal-400'
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-ink-secondary dark:text-[#83A6CE] truncate">
                        {notifPermission === 'granted'
                          ? 'Device alerts active'
                          : notifPermission === 'denied'
                            ? 'Blocked in browser'
                            : notifPermission === 'unsupported'
                              ? 'In-app alerts only'
                              : 'Enable computer/phone alerts'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleSound}
                        title={soundEnabled ? 'Mute alert chime' : 'Unmute alert chime'}
                        aria-label={soundEnabled ? 'Mute alert chime' : 'Unmute alert chime'}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
                      >
                        {soundEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {notifPermission === 'granted' ? (
                        <button
                          type="button"
                          onClick={handleTestAlert}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-surface-card dark:bg-[#122444] border border-surface-border dark:border-[#26415E] text-ink-primary dark:text-[#F8FAFC] hover:border-teal-500 transition-colors"
                        >
                          Test
                        </button>
                      ) : notifPermission === 'default' ? (
                        <button
                          type="button"
                          disabled={enablingPush}
                          onClick={handleEnableDeviceAlerts}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-60"
                        >
                          {enablingPush ? 'Enabling...' : 'Enable'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 max-h-[60dvh] sm:max-h-80 overflow-y-auto divide-y divide-surface-border/60 dark:divide-[#26415E]/60">
                    {staffNotifs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-ink-muted">
                        No notifications yet. Lab messages, orders, and booking alerts appear here live.
                      </div>
                    ) : (
                      staffNotifs.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.read) notificationService.markAsRead(n.id);
                            setShowNotifPopover(false);
                            if (n.link) {
                              navigate(n.link);
                            } else if (n.type === 'APPOINTMENT') {
                              navigate('/clinic/queue');
                            } else if (n.type === 'LAB_ORDER' || n.type === 'LAB_MESSAGE') {
                              const isClinicRole =
                                user?.role === ROLES.DENTIST || user?.role === ROLES.RECEPTIONIST;
                              navigate(isClinicRole ? '/clinic/lab-orders' : '/lab');
                            }
                          }}
                          className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface-50 dark:hover:bg-[#26415E]/50 ${!n.read ? 'bg-teal-50/50 dark:bg-[#83A6CE]/10' : ''
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <p className="text-xs font-bold text-ink-primary dark:text-[#F8FAFC] min-w-0 break-words">
                              {n.title}
                            </p>
                            <span className="text-[10px] text-ink-muted shrink-0">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-secondary dark:text-[#83A6CE] mt-0.5 line-clamp-2 break-words">
                            {dedupeDoctorPrefix(n.message)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* User profile & dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifPopover(false);
            }}
            className="flex items-center gap-2 p-1 xs:p-1.5 rounded-xl hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors focus:outline-none"
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <Avatar name={user?.fullName || user?.name || user?.email} size="sm" />
            <div className="hidden lg:block text-left max-w-[140px]">
              <p className="text-xs font-heading font-bold text-ink-primary leading-tight dark:text-[#F8FAFC] truncate">
                {user?.fullName || user?.name || 'User'}
              </p>
              <p className="text-[10px] text-teal-600 dark:text-[#C48CB3] font-semibold uppercase truncate">
                {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted dark:text-[#83A6CE] hidden lg:block shrink-0" />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="fixed sm:absolute right-2 sm:right-0 top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)] sm:top-auto sm:mt-2 w-[min(15rem,calc(100vw-1rem))] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl bg-surface-card dark:bg-[#0D1E4C]/95 dark:backdrop-blur-xl border border-surface-border dark:border-[#26415E] shadow-soft-lg dark:shadow-[0_12px_30px_rgba(11,27,50,0.8)] z-50 p-2 py-2 space-y-1">
                <div className="px-3 py-2 border-b border-surface-border/60 dark:border-[#26415E]/80 mb-1">
                  <p className="text-sm font-heading font-bold text-ink-primary dark:text-[#F8FAFC] truncate">
                    {user?.fullName || user?.name || 'User'}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-[#83A6CE] truncate">{user?.email}</p>
                </div>

                {isPatient && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        toggleSparky();
                        setShowDropdown(false);
                      }}
                      className="w-full md:hidden flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-semibold text-ink-secondary dark:text-[#E5C9D7] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 rounded-xl transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Smile className="w-4 h-4 text-teal-600 dark:text-[#C48CB3]" />
                        <span>Gardy Mascot</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7]">
                        {showSparky ? 'On' : 'Off'}
                      </span>
                    </button>

                    <Link
                      to="/patient/profile"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink-secondary dark:text-[#E5C9D7] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 rounded-xl transition-colors"
                    >
                      <User className="w-4 h-4 text-teal-600 dark:text-[#83A6CE]" />
                      <span>My Profile &amp; Settings</span>
                    </Link>
                  </>
                )}

                {user?.role === ROLES.ADMIN && (
                  <Link
                    to="/admin/users"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink-secondary dark:text-[#E5C9D7] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 rounded-xl transition-colors"
                  >
                    <Shield className="w-4 h-4 text-teal-600 dark:text-[#83A6CE]" />
                    <span>User Management</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-[#C48CB3] hover:bg-rose-50 dark:hover:bg-[#C48CB3]/10 rounded-xl transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
