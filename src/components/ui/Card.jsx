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
          'rounded-2xl border border-surface-border bg-surface-card transition-all duration-200',
          glass ? 'glass-panel' : 'shadow-soft-sm',
          hoverEffect && 'hover:shadow-soft hover:border-teal-300 dark:hover:border-teal-700/60 hover:-translate-y-0.5 cursor-pointer',
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
    <div className={twMerge(clsx('p-5 pb-3 border-b border-surface-border/60 flex items-center justify-between', className))} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={twMerge(clsx('text-lg font-heading font-bold text-ink-primary tracking-tight', className))} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={twMerge(clsx('text-xs text-ink-muted mt-0.5', className))} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('p-5', className))} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('p-5 pt-3 border-t border-surface-border/60 bg-surface-50/50 dark:bg-surface-100/30 rounded-b-2xl', className))} {...props}>
      {children}
    </div>
  );
}
