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
          variant === 'pills' && 'bg-surface-100/80 dark:bg-[#0B1B32]/90 p-1.5 rounded-2xl border border-surface-border/50 dark:border-[#26415E]/80',
          variant === 'underline' && 'border-b border-surface-border dark:border-[#26415E]/80 gap-6',
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
                  ? 'border-teal-600 text-teal-600 dark:border-[#83A6CE] dark:text-[#E5C9D7] font-bold'
                  : 'border-transparent text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:border-surface-300 dark:hover:border-[#26415E]'
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold',
                    isActive
                      ? 'bg-teal-100 text-teal-800 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7]'
                      : 'bg-surface-200 dark:bg-[#26415E] text-ink-muted dark:text-[#83A6CE]'
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
                ? 'bg-surface-card dark:bg-[#26415E]/90 text-teal-700 dark:text-[#E5C9D7] shadow-soft-sm dark:shadow-[0_2px_8px_rgba(11,27,50,0.6)] dark:border dark:border-[#83A6CE]/40 font-bold'
                : 'text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-[#F8FAFC] hover:bg-surface-50 dark:hover:bg-[#26415E]/40'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={clsx(
                  'text-[11px] px-1.5 py-0.5 rounded-full font-bold',
                  isActive
                    ? 'bg-teal-100 text-teal-800 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7]'
                    : 'bg-surface-200 dark:bg-[#26415E] text-ink-secondary dark:text-[#83A6CE]'
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
