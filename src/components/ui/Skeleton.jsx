import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className = '', variant = 'text', count = 1 }) {
  const baseStyles = 'animate-pulse bg-surface-200 dark:bg-surface-300/50 rounded-xl';

  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full w-10 h-10',
    rectangular: 'h-24 w-full rounded-2xl',
    card: 'h-40 w-full rounded-3xl',
  };

  if (count > 1) {
    return (
      <div className="space-y-2.5 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={twMerge(clsx(baseStyles, variants[variant], className))}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={twMerge(clsx(baseStyles, variants[variant], className))} />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 rounded-3xl bg-surface-card border border-surface-border animate-pulse space-y-4 shadow-soft-sm">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="w-1/3 h-5" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-20" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton variant="text" className="w-1/4 h-4" />
        <Skeleton variant="text" className="w-1/5 h-8 rounded-xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="w-full bg-surface-card rounded-2xl border border-surface-border overflow-hidden">
      <div className="p-4 border-b border-surface-border bg-surface-50 dark:bg-surface-100 flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y divide-surface-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4 items-center animate-pulse">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-20 rounded-xl ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
