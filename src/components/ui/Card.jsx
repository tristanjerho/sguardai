import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({
  children,
  className = '',
  hoverEffect = false,
  glass = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'min-w-0 rounded-2xl border border-surface-border bg-surface-card transition-all duration-200',
          'dark:border-[#26415E]/80 dark:bg-[#0D1E4C]/90 dark:shadow-[0_6px_25px_-4px_rgba(11,27,50,0.7),inset_0_1px_0_0_rgba(131,166,206,0.1)]',
          glass ? 'glass-panel' : 'shadow-soft-sm',
          hoverEffect && 'hover:shadow-soft hover:border-teal-300 dark:hover:border-[#83A6CE]/60 hover:-translate-y-0.5 cursor-pointer',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 pb-3 border-b border-surface-border/60 dark:border-[#26415E]/80 w-full flex flex-wrap items-center justify-between gap-2.5 sm:gap-4', className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={twMerge(clsx('text-base sm:text-lg font-heading font-bold text-ink-primary tracking-tight min-w-0 break-words', className))} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={twMerge(clsx('text-xs text-ink-muted mt-0.5 break-words', className))} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 min-w-0', className))} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('p-4 sm:p-5 pt-3 border-t border-surface-border/60 dark:border-[#26415E]/80 bg-surface-50/50 dark:bg-[#0B1B32]/70 rounded-b-2xl min-w-0', className))} {...props}>
      {children}
    </div>
  );
}
