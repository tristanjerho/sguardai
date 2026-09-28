import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  Shield,
  Smile,
  Menu,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useMascot } from '../../context/MascotContext';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../common/Logo';
import { ROLES } from '../../lib/roles';

export function Topbar({ title, onMenuToggle, showMenuButton = false, unreadCount = 0 }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showSparky, toggleSparky } = useMascot();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isPatient = user?.role === ROLES.PATIENT;

  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-surface-border dark:border-[#26415E]/80 bg-surface-card/90 dark:bg-[#0B1B32]/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between transition-colors shadow-xs">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:bg-surface-100 dark:hover:bg-[#26415E]/60 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Logo size="md" />

          {title && (
            <>
              <span className="hidden sm:inline-block text-surface-300 dark:text-[#26415E] font-light">/</span>
              <h1 className="hidden sm:inline-block text-sm font-heading font-semibold text-ink-secondary dark:text-[#E5C9D7] truncate max-w-[200px] lg:max-w-xs">
                {title}
              </h1>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Sparky Mascot toggle for patients only */}
        {isPatient && (
          <button
            type="button"
            onClick={toggleSparky}
            title={showSparky ? 'Hide Sparky Mascot' : 'Show Sparky Mascot'}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSparky
                ? 'bg-teal-50 text-teal-700 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] border border-teal-200 dark:border-[#83A6CE]/30'
                : 'text-ink-muted dark:text-[#83A6CE] hover:bg-surface-100 dark:hover:bg-[#26415E]/60'
            }`}
            aria-label="Toggle Sparky Mascot"
          >
            <Smile className="w-4 h-4 text-teal-600 dark:text-[#C48CB3]" />
            <span className="hidden md:inline">Sparky</span>
          </button>
        )}

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-[#E5C9D7] drop-shadow-[0_0_8px_rgba(229,201,215,0.6)]" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Notifications Icon (Patient only links to /patient/notifications) */}
        {isPatient && (
          <Link
            to="/patient/notifications"
            className="relative p-2 rounded-xl text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#C48CB3] rounded-full ring-2 ring-surface-card dark:ring-[#0B1B32] animate-pulse" />
            )}
          </Link>
        )}

        {/* User profile & dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors focus:outline-none"
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <Avatar name={user?.fullName || user?.name || user?.email} size="sm" />
            <div className="hidden lg:block text-left">
              <p className="text-xs font-heading font-bold text-ink-primary leading-tight dark:text-[#F8FAFC]">
                {user?.fullName || user?.name || 'User'}
              </p>
              <p className="text-[10px] text-teal-600 dark:text-[#C48CB3] font-semibold uppercase">
                {user?.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted dark:text-[#83A6CE] hidden lg:block" />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-card dark:bg-[#0D1E4C]/95 dark:backdrop-blur-xl border border-surface-border dark:border-[#26415E] shadow-soft-lg dark:shadow-[0_12px_30px_rgba(11,27,50,0.8)] z-50 p-2 py-2 space-y-1">
                <div className="px-3 py-2 border-b border-surface-border/60 dark:border-[#26415E]/80 mb-1">
                  <p className="text-sm font-heading font-bold text-ink-primary dark:text-[#F8FAFC]">
                    {user?.fullName || user?.name || 'User'}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-[#83A6CE] truncate">{user?.email}</p>
                </div>

                {isPatient && (
                  <Link
                    to="/patient/profile"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink-secondary dark:text-[#E5C9D7] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4 text-teal-600 dark:text-[#83A6CE]" />
                    <span>My Profile & Settings</span>
                  </Link>
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
