import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  Activity,
  FolderArchive,
  Inbox,
  User,
  Users,
  Clock,
  ClipboardList,
  FlaskConical,
  BrainCircuit,
  ShieldAlert,
  ShieldCheck,
  ChevronsRight,
  ChevronsLeft,
  X,
} from 'lucide-react';
import { ROLES } from '../../lib/roles';
import { Logo } from '../common/Logo';

export function Sidebar({
  role,
  isOpen = false,
  onClose,
  tabletExpanded = false,
  onTabletToggle,
}) {
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
      { to: '/lab', label: 'Order Intake & Admin', icon: Inbox, end: true },
      { to: '/lab/board', label: 'Laboratory Production Board', icon: FlaskConical },
    ];
  } else if (
    role === ROLES.DENTIST ||
    role === ROLES.RECEPTIONIST ||
    role === ROLES.ADMIN ||
    role === ROLES.SUPERADMIN
  ) {
    const clinicItems = [
      { to: '/clinic', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/clinic/queue', label: 'Appointments Queue', icon: Clock },
      { to: '/clinic/patients', label: 'Patient Directory', icon: Users },
      { to: '/clinic/treatments', label: 'Treatment Plans', icon: ClipboardList },
      { to: '/clinic/lab-orders', label: 'Lab Prescriptions', icon: FlaskConical },
      { to: '/clinic/ai-workstation', label: 'AI Workstation', icon: BrainCircuit, badge: 'AI' },
    ];

    if (role === ROLES.SUPERADMIN) {
      navItems = [
        { to: '/admin/super', label: 'Command Center', icon: ShieldCheck, badge: 'ROOT', end: true },
        { to: '/admin/users', label: 'User Registry & Roles', icon: Users },
        { to: '/admin/logs', label: 'Security & Audit Stream', icon: ShieldAlert },
        { type: 'divider', label: 'Operational Portals' },
        { to: '/clinic', label: 'Chairside Clinic Portal', icon: LayoutDashboard },
        { to: '/lab', label: 'Lab Order Intake', icon: Inbox, end: true },
        { to: '/lab/board', label: 'Laboratory Production Board', icon: FlaskConical },
      ];
    } else if (role === ROLES.ADMIN) {
      navItems = [
        { to: '/admin/users', label: 'User Management', icon: Users, end: true },
        { to: '/admin/logs', label: 'Activity Logs', icon: ShieldAlert },
        { type: 'divider', label: 'Operational Portals' },
        { to: '/clinic', label: 'Chairside Clinic Portal', icon: LayoutDashboard },
        { to: '/lab', label: 'Lab Order Intake', icon: Inbox, end: true },
        { to: '/lab/board', label: 'Laboratory Production Board', icon: FlaskConical },
      ];
    } else {
      navItems = clinicItems;
    }
  }

  const labelVisibilityClass = tabletExpanded ? 'inline truncate' : 'inline md:hidden lg:inline truncate';

  return (
    <>
      {/* Mobile slide-over drawer backdrop (< md) */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Tablet expanded overlay backdrop (md .. < lg) */}
      {tabletExpanded && onTabletToggle && (
        <div
          className="fixed inset-0 top-16 bg-slate-950/20 backdrop-blur-xs z-30 hidden md:block lg:hidden"
          onClick={onTabletToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container:
          - Mobile (< md): w-64 slide-over drawer
          - Tablet (md .. < lg): persistent compact icon rail (w-[4.5rem]) that expands to w-64 overlay on toggle
          - Desktop (>= lg): persistent w-64 sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`fixed inset-y-0 left-0 bg-surface-card dark:bg-[#0B1B32]/95 dark:backdrop-blur-xl border-r border-surface-border dark:border-[#26415E]/80 flex flex-col transition-all duration-200 ease-in-out w-64 md:top-16 md:bottom-0 md:left-0 lg:z-30 lg:w-64 lg:translate-x-0 ${
          isOpen ? 'translate-x-0 z-50' : '-translate-x-full md:translate-x-0'
        } ${
          tabletExpanded
            ? 'md:w-64 md:z-40 md:shadow-soft-xl'
            : 'md:w-[4.5rem] md:z-30'
        }`}
      >
        {/* Mobile Drawer Header (< md) */}
        <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-surface-border dark:border-[#26415E]/80 md:hidden shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Logo size="sm" asLink={false} />
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] dark:border dark:border-[#83A6CE]/30 truncate">
              {role}
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100 dark:hover:bg-[#26415E]/60 shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tablet Compact Rail Expand/Collapse Bar (md .. < lg) */}
        {onTabletToggle && (
          <div
            className={`hidden md:flex lg:hidden items-center border-b border-surface-border/70 dark:border-[#26415E]/70 px-3 py-2 shrink-0 ${
              tabletExpanded ? 'justify-between' : 'justify-center'
            }`}
          >
            {tabletExpanded && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] truncate">
                {role}
              </span>
            )}
            <button
              type="button"
              onClick={onTabletToggle}
              className="p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-surface-100 dark:hover:bg-[#26415E]/60 transition-colors"
              aria-label={tabletExpanded ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
              title={tabletExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {tabletExpanded ? (
                <ChevronsLeft className="w-4 h-4" />
              ) : (
                <ChevronsRight className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 min-h-0 px-2.5 lg:px-3 py-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {navItems.map((item, idx) => {
            if (item.type === 'divider') {
              return (
                <div key={idx} className="pt-3 pb-1.5 px-2 lg:px-3">
                  <div
                    className={`border-t border-surface-border dark:border-[#26415E]/80 hidden ${
                      tabletExpanded ? '' : 'md:block lg:hidden'
                    }`}
                  />
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-[#83A6CE]/70 ${
                      tabletExpanded ? 'block' : 'block md:hidden lg:block'
                    }`}
                  >
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
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 py-2.5 ${
                    tabletExpanded
                      ? 'justify-between px-3.5'
                      : 'justify-between md:justify-center md:px-2 lg:justify-between lg:px-3.5 px-3.5'
                  } ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-soft dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7] dark:border dark:border-[#83A6CE]/35 dark:shadow-[0_0_15px_rgba(131,166,206,0.18)]'
                      : 'text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:bg-surface-100 dark:hover:bg-[#26415E]/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`flex items-center gap-3 min-w-0 ${
                        tabletExpanded ? '' : 'md:justify-center lg:justify-start'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-white dark:text-[#C48CB3]'
                            : item.highlight
                              ? 'text-orange-500 dark:text-[#C48CB3]'
                              : 'text-teal-600 dark:text-[#83A6CE] group-hover:dark:text-[#E5C9D7]'
                        }`}
                      />
                      <span className={labelVisibilityClass}>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${labelVisibilityClass} ${
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

        {/* Clinic emergency hotline / assistance badge (compact icon tooltip on collapsed tablet rail) */}
        <div
          className={`m-2.5 lg:m-3 rounded-2xl bg-teal-50/70 dark:bg-[#0D1E4C]/90 border border-teal-200/60 dark:border-[#26415E]/80 dark:shadow-inner relative overflow-hidden shrink-0 ${
            tabletExpanded ? 'p-4' : 'p-4 md:p-2.5 lg:p-4'
          }`}
          title="Dental Support Hotline: +63 (2) 8888-DENT"
        >
          <div
            className={`flex items-center gap-2 ${
              tabletExpanded ? 'mb-1' : 'mb-1 md:mb-0 md:justify-center lg:mb-1 lg:justify-start'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#C48CB3] animate-pulse shrink-0" />
            <p
              className={`text-xs font-heading font-bold text-teal-900 dark:text-[#E5C9D7] ${labelVisibilityClass}`}
            >
              Need Dental Support?
            </p>
          </div>
          <p
            className={`text-[11px] text-teal-700 dark:text-[#83A6CE] font-medium pl-4 ${
              tabletExpanded ? 'block' : 'block md:hidden lg:block'
            }`}
          >
            Hotline: <strong className="text-teal-800 dark:text-[#E5C9D7]">+63 (2) 8888-DENT</strong>
          </p>
        </div>
      </aside>
    </>
  );
}
