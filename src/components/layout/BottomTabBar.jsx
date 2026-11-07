import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import { ROLES } from '../../lib/roles';
import { useAuth } from '../../hooks/useAuth';
import { getNavItemsByRole } from './Sidebar';

function routeIsActive(pathname, item) {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function BottomTabBar({ role }) {
  const { user } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { pathname } = useLocation();

  const effectiveRole = role || user?.role || ROLES.PATIENT;
  const links = getNavItemsByRole(effectiveRole).filter((item) => item.type !== 'divider');

  const tabs = links.length > 4 ? links.slice(0, 4) : links;
  const more = links.length > 4 ? links.slice(4) : [];
  const moreIsActive = more.some((item) => routeIsActive(pathname, item));

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  if (links.length === 0) return null;

  return (
    <>
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/15 lg:hidden"
          onClick={() => setIsMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-card/95 px-2 pt-2 shadow-soft-lg backdrop-blur-md dark:border-[#26415E]/80 dark:bg-[#0B1B32]/95 lg:hidden"
        style={{
          paddingBottom: 'max(1.75rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))',
        }}
        aria-label="Mobile Bottom Navigation"
      >
        {isMoreOpen && more.length > 0 && (
          <div
            id="mobile-more-menu"
            className="absolute inset-x-3 bottom-full z-40 mb-2 rounded-2xl border border-surface-border bg-surface-card p-3 shadow-soft-lg dark:border-[#26415E] dark:bg-[#0B1B32]"
          >
            <p className="mb-2 px-1 text-xs font-bold text-ink-muted dark:text-[#83A6CE]">
              More destinations
            </p>
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
                      `flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white dark:bg-[#83A6CE]/25 dark:text-[#E5C9D7]'
                          : 'bg-surface-subtle text-ink-secondary hover:text-ink-primary dark:bg-[#122444] dark:text-[#83A6CE] dark:hover:text-[#F8FAFC]'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-[#C48CB3]/20 dark:text-[#E5C9D7] shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-stretch justify-around gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors ${
                    isActive
                      ? 'font-bold text-teal-600 dark:text-teal-400'
                      : 'text-ink-muted hover:text-ink-primary dark:text-[#83A6CE] dark:hover:text-[#F8FAFC]'
                  }`
                }
              >
                <Icon className="mb-0.5 h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-[10px]">
                  {tab.shortLabel || tab.label}
                </span>
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
                  : 'text-ink-muted hover:text-ink-primary dark:text-[#83A6CE] dark:hover:text-[#F8FAFC]'
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
