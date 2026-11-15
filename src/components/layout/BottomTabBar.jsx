import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  Activity,
  FolderArchive,
  Clock,
  Users,
  ClipboardList,
  BrainCircuit,
  Inbox,
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { ROLES } from '../../lib/roles';

function getTabsForRole(role) {
  if (role === ROLES.LAB_TECH) {
    return [
      { to: '/lab', label: 'Intake', icon: Inbox, end: true },
      { to: '/lab/board', label: 'Board', icon: FlaskConical },
    ];
  }

  if (role === ROLES.SUPERADMIN) {
    return [
      { to: '/admin/super', label: 'Root', icon: ShieldCheck, end: true },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/logs', label: 'Logs', icon: ShieldAlert },
      { to: '/clinic', label: 'Clinic', icon: LayoutDashboard },
      { to: '/lab', label: 'Lab', icon: FlaskConical },
    ];
  }

  if (role === ROLES.ADMIN) {
    return [
      { to: '/admin/users', label: 'Users', icon: Users, end: true },
      { to: '/admin/logs', label: 'Logs', icon: ShieldAlert },
      { to: '/clinic', label: 'Clinic', icon: LayoutDashboard },
      { to: '/lab', label: 'Lab', icon: FlaskConical },
    ];
  }

  if (role === ROLES.DENTIST || role === ROLES.RECEPTIONIST) {
    return [
      { to: '/clinic', label: 'Clinic', icon: LayoutDashboard, end: true },
      { to: '/clinic/queue', label: 'Queue', icon: Clock },
      { to: '/clinic/patients', label: 'Patients', icon: Users },
      { to: '/clinic/treatments', label: 'Plans', icon: ClipboardList },
      { to: '/clinic/ai-workstation', label: 'AI', icon: BrainCircuit },
    ];
  }

  // Default: Patient portal tabs
  return [
    { to: '/patient', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/patient/appointments', label: 'Visits', icon: CalendarCheck },
    { to: '/patient/book', label: 'Book', icon: CalendarPlus, primary: true },
    { to: '/patient/treatment', label: 'Progress', icon: Activity },
    { to: '/patient/records', label: 'Records', icon: FolderArchive },
  ];
}

export function BottomTabBar({ role = ROLES.PATIENT }) {
  const tabs = getTabsForRole(role);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-surface-card/95 dark:bg-[#0B1B32]/95 backdrop-blur-md border-t border-surface-border dark:border-[#26415E]/80 md:hidden px-1.5 xs:px-3 pt-1.5 shadow-soft-lg safe-bottom-nav"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around gap-0.5 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex-1 min-w-0 flex flex-col items-center justify-center -mt-4"
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center shadow-soft transition-transform duration-200 ${
                        isActive
                          ? 'bg-teal-600 text-white ring-4 ring-teal-100 dark:ring-teal-950 scale-105'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 mt-0.5 truncate max-w-full">
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
                `flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] truncate max-w-full">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
