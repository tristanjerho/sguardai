import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  Activity,
  FolderArchive,
  Flame,
  User,
  Users,
  Clock,
  ClipboardList,
  FlaskConical,
  BrainCircuit,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ROLES } from '../../lib/roles';
import { Logo } from '../common/Logo';

export function Sidebar({ role, isOpen = true, onClose }) {
  let navItems = [];

  if (role === ROLES.PATIENT) {
    navItems = [
      { to: '/patient', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/patient/book', label: 'Book Appointment', icon: CalendarPlus },
      { to: '/patient/appointments', label: 'My Appointments', icon: CalendarCheck },
      { to: '/patient/treatment', label: 'Treatment Progress', icon: Activity },
      { to: '/patient/records', label: 'Dental Records', icon: FolderArchive },
      { to: '/patient/profile', label: 'Profile & Settings', icon: User },
    ];
  } else if (role === ROLES.LAB_TECH) {
    navItems = [
      { to: '/lab', label: 'Lab Production Board', icon: FlaskConical, end: true },
      { to: '/lab/orders', label: 'All Lab Orders', icon: ClipboardList },
    ];
  } else if (role === ROLES.DENTIST || role === ROLES.ADMIN || role === ROLES.SUPERADMIN) {
    const clinicItems = [
      { to: '/clinic', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/clinic/queue', label: 'Appointments Queue', icon: Clock },
      { to: '/clinic/patients', label: 'Patient Directory', icon: Users },
      { to: '/clinic/treatments', label: 'Treatment Plans', icon: ClipboardList },
      { to: '/clinic/lab-orders', label: 'Lab Orders', icon: FlaskConical },
      { to: '/clinic/ai-workstation', label: 'AI Workstation', icon: BrainCircuit, badge: 'AI' },
    ];

    if (role === ROLES.SUPERADMIN) {
      navItems = [
        { to: '/admin/super', label: 'Command Center', icon: ShieldCheck, badge: 'ROOT', end: true },
        { to: '/admin/users', label: 'User Registry & Roles', icon: Users },
        { to: '/admin/logs', label: 'Security & Audit Stream', icon: ShieldAlert },
        { to: '/lab', label: 'CAD/CAM Laboratory', icon: FlaskConical },
        { type: 'divider', label: 'Operational Portals' },
        { to: '/clinic', label: 'Chairside Clinic Portal', icon: LayoutDashboard },
      ];
    } else if (role === ROLES.ADMIN) {
      navItems = [
        { to: '/admin/users', label: 'User Management', icon: Users, end: true },
        { to: '/admin/logs', label: 'Activity Logs', icon: ShieldAlert },
        { to: '/lab', label: 'Laboratory Pipeline', icon: FlaskConical },
        { type: 'divider', label: 'Operational Portals' },
        { to: '/clinic', label: 'Chairside Clinic Portal', icon: LayoutDashboard },
      ];
    } else {
      navItems = clinicItems;
    }
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-card dark:bg-[#0B1B32]/95 dark:backdrop-blur-xl border-r border-surface-border dark:border-[#26415E]/80 flex flex-col transition-transform duration-200 ease-in-out lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:z-30 lg:w-64 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-surface-border dark:border-[#26415E]/80 lg:hidden">
          <div className="flex items-center gap-2">
            <Logo size="sm" asLink={false} />
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] dark:border dark:border-[#83A6CE]/30">
              {role}
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100 dark:hover:bg-[#26415E]/60 lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item, idx) => {
            if (item.type === 'divider') {
              return (
                <div key={idx} className="pt-4 pb-2 px-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-[#83A6CE]/70">
                    {item.label}
                  </p>
                </div>
              );
            }

            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-soft dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] dark:border dark:border-[#83A6CE]/35 dark:shadow-[0_0_15px_rgba(131,166,206,0.18)]'
                      : 'text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:bg-surface-100 dark:hover:bg-[#26415E]/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-white dark:text-[#C48CB3]'
                            : item.highlight
                            ? 'text-orange-500 dark:text-[#C48CB3]'
                            : 'text-teal-600 dark:text-[#83A6CE] group-hover:dark:text-[#E5C9D7]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isActive
                            ? 'bg-white/20 text-white dark:bg-[#C48CB3]/30 dark:text-[#E5C9D7]'
                            : 'bg-orange-100 text-orange-700 dark:bg-[#C48CB3]/20 dark:text-[#E5C9D7] dark:border dark:border-[#C48CB3]/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Clinic emergency hotline / assistance badge */}
        <div className="p-4 m-3 rounded-2xl bg-teal-50/70 dark:bg-[#0D1E4C]/90 border border-teal-200/60 dark:border-[#26415E]/80 dark:shadow-inner relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#C48CB3] animate-pulse" />
            <p className="text-xs font-heading font-bold text-teal-900 dark:text-[#E5C9D7]">
              Need Dental Support?
            </p>
          </div>
          <p className="text-[11px] text-teal-700 dark:text-[#83A6CE] font-medium pl-4">
            Hotline: <strong className="text-teal-800 dark:text-[#E5C9D7]">+63 (2) 8888-DENT</strong>
          </p>
        </div>
      </aside>
    </>
  );
}
