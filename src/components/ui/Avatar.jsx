import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Avatar({
  name = '',
  src,
  size = 'md',
  status,
  className = '',
}) {
  const getInitials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-lg font-bold',
  };

  const statusColors = {
    online: 'bg-emerald-500 ring-surface-card',
    busy: 'bg-rose-500 ring-surface-card',
    away: 'bg-amber-500 ring-surface-card',
    offline: 'bg-slate-400 ring-surface-card',
  };

  return (
    <div className={twMerge(clsx('relative inline-flex flex-shrink-0', className))}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={clsx(
            'rounded-full object-cover border border-surface-border bg-surface-100',
            sizes[size]
          )}
        />
      ) : (
        <div
          className={clsx(
            'rounded-full flex items-center justify-center font-heading font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 border border-teal-200 dark:border-teal-800 select-none shadow-soft-sm',
            sizes[size]
          )}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full ring-2',
            statusColors[status] || 'bg-slate-400'
          )}
        />
      )}
    </div>
  );
}
