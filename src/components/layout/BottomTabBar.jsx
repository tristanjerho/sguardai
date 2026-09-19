import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  Activity,
  Flame,
} from 'lucide-react';

export function BottomTabBar() {
  const tabs = [
    { to: '/patient', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/patient/appointments', label: 'Visits', icon: CalendarCheck },
    { to: '/patient/book', label: 'Book', icon: CalendarPlus, primary: true },
    { to: '/patient/treatment', label: 'Progress', icon: Activity },
    { to: '/patient/brush-streak', label: 'Streak', icon: Flame },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-surface-card/90 backdrop-blur-md border-t border-surface-border lg:hidden px-2 py-1.5 shadow-soft-lg"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex flex-col items-center justify-center -mt-5"
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-soft transition-transform duration-200 ${
                        isActive
                          ? 'bg-teal-600 text-white ring-4 ring-teal-100 dark:ring-teal-950 scale-105'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 mt-1">
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
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
