import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex space-x-1 overflow-x-auto p-1 scrollbar-none',
          variant === 'pills' && 'bg-surface-100/80 dark:bg-surface-200/50 p-1.5 rounded-2xl border border-surface-border/50',
          variant === 'underline' && 'border-b border-surface-border gap-6',
          className
        )
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'flex items-center gap-2 py-3 px-1 text-sm font-semibold border-b-2 transition-all duration-150 whitespace-nowrap',
                isActive
                  ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-surface-300'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold',
                    isActive
                      ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                      : 'bg-surface-200 text-ink-muted'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap',
              isActive
                ? 'bg-surface-card text-teal-700 dark:text-teal-300 shadow-soft-sm font-bold'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-50 dark:hover:bg-surface-300/30'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={clsx(
                  'text-[11px] px-1.5 py-0.5 rounded-full font-bold',
                  isActive
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                    : 'bg-surface-200 dark:bg-surface-300 text-ink-secondary'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
