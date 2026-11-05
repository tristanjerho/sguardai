import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  Ellipsis,
  FlaskConical,
  FolderArchive,
  Inbox,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Users,
  BrainCircuit,
  Clock,
} from 'lucide-react';
import { ROLES } from '../../lib/roles';

const NAVIGATION_BY_ROLE = {
  [ROLES.PATIENT]: {
    tabs: [
      { to: '/patient', label: 'Home', icon: LayoutDashboard, end: true },
      { to: '/patient/appointments', label: 'Visits', icon: CalendarCheck },
      { to: '/patient/book', label: 'Book', icon: CalendarPlus, primary: true },
      { to: '/patient/treatment', label: 'Progress', icon: Activity },
      { to: '/patient/records', label: 'Records', icon: FolderArchive },
    ],
  },
  [ROLES.LAB_TECH]: {
    tabs: [
      { to: '/lab', label: 'Intake', icon: Inbox, end: true },
      { to: '/lab/board', label: 'Production', icon: FlaskConical },
    ],
  },
  [ROLES.DENTIST]: {
    tabs: [
      { to: '/clinic', label: 'Home', icon: LayoutDashboard, end: true },
      { to: '/clinic/queue', label: 'Queue', icon: Clock },
      { to: '/clinic/patients', label: 'Patients', icon: Users },
      { to: '/clinic/lab-orders', label: 'Lab', icon: FlaskConical },
    ],
    more: [
      { to: '/clinic/treatments', label: 'Treatment Plans', icon: ClipboardList },
      { to: '/clinic/ai-workstation', label: 'AI Workstation', icon: BrainCircuit },
    ],
  },
  [ROLES.ADMIN]: {
    tabs: [
      { to: '/admin/users', label: 'Users', icon: Users, end: true },
      { to: '/admin/logs', label: 'Logs', icon: ShieldAlert },
      { to: '/clinic', label: 'Clinic', icon: LayoutDashboard },
      { to: '/lab', label: 'Lab Intake', icon: Inbox, end: true },
    ],
    more: [{ to: '/lab/board', label: 'Production Board', icon: FlaskConical }],
  },
  [ROLES.SUPERADMIN]: {
    tabs: [
      { to: '/admin/super', label: 'Command', icon: ShieldCheck, end: true },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/logs', label: 'Logs', icon: ShieldAlert },
      { to: '/clinic', label: 'Clinic', icon: LayoutDashboard },
    ],
    more: [
      { to: '/lab', label: 'Lab Intake', icon: Inbox, end: true },
      { to: '/lab/board', label: 'Production Board', icon: FlaskConical },
    ],
  },
};

function routeIsActive(pathname, item) {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function BottomTabBar({ role = ROLES.PATIENT }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const { tabs = [], more = [] } = NAVIGATION_BY_ROLE[role] || NAVIGATION_BY_ROLE[ROLES.PATIENT];
  const moreIsActive = more.some((item) => routeIsActive(pathname, item));

  return (
    <>
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/15 lg:hidden"
          onClick={() => setIsMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface-card/95 px-2 pt-2 shadow-soft-lg backdrop-blur-md dark:border-[#26415E]/80 dark:bg-[#0B1B32]/95 lg:hidden"
        style={{
          paddingBottom: 'max(1.75rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))',
        }}
        aria-label="Mobile bottom navigation"
      >
        {isMoreOpen && more.length > 0 && (
          <div
            id="mobile-more-menu"
            className="absolute inset-x-3 bottom-full z-50 mb-2 rounded-2xl border border-surface-border bg-surface-card p-3 shadow-soft-lg dark:border-[#26415E] dark:bg-[#0B1B32]"
          >
            <p className="mb-2 px-1 text-xs font-bold text-ink-muted">More destinations</p>
            <div className="grid grid-cols-2 gap-2">
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white'
                          : 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-stretch justify-around gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            if (tab.primary) {
              return (
                <NavLink key={tab.to} to={tab.to} className="-mt-5 flex min-w-0 flex-1 flex-col items-center justify-center">
                  {({ isActive }) => (
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-soft transition-transform duration-200 ${
                          isActive ? 'scale-105 ring-4 ring-teal-100 dark:ring-teal-950' : 'hover:bg-teal-700'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="mt-1 text-[10px] font-bold text-teal-700 dark:text-teal-400">
                        {tab.label}
                      </span>
                    </div>
                  )}
                </NavLink>
              );
            }

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors ${
                    isActive
                      ? 'font-bold text-teal-600 dark:text-teal-400'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`
                }
              >
                <Icon className="mb-0.5 h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-[10px]">{tab.label}</span>
              </NavLink>
            );
          })}

          {more.length > 0 && (
            <button
              type="button"
              aria-controls="mobile-more-menu"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((open) => !open)}
              className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors ${
                moreIsActive || isMoreOpen
                  ? 'font-bold text-teal-600 dark:text-teal-400'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Ellipsis className="mb-0.5 h-5 w-5" />
              <span className="text-[10px]">More</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}