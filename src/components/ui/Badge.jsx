import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getStatusColor } from '../../lib/formatters';

export function Badge({
  children,
  variant,
  status,
  size = 'md',
  showDot = false,
  className = '',
}) {
  let colorStyles = 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]';
  let dotColor = 'bg-slate-400';

  if (status) {
    const computed = getStatusColor(status);
    colorStyles = computed.badge;
    dotColor = computed.dot;
  } else if (variant === 'primary') {
    colorStyles = 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25';
    dotColor = 'bg-teal-500';
  } else if (variant === 'accent') {
    colorStyles = 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25';
    dotColor = 'bg-orange-500';
  } else if (variant === 'success') {
    colorStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25';
    dotColor = 'bg-emerald-500';
  } else if (variant === 'danger') {
    colorStyles = 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25';
    dotColor = 'bg-rose-500';
  } else if (variant === 'warning') {
    colorStyles = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25';
    dotColor = 'bg-amber-500';
  }

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 rounded-full border',
          sizes[size],
          colorStyles,
          className
        )
      )}
    >
      {showDot && <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />}
      <span>{children}</span>
    </span>
  );
}
