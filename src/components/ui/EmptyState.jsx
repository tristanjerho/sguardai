import React from 'react';
import { Sparkles, Inbox } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display.',
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-surface-border bg-surface-50/50 dark:bg-surface-100/20 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 shadow-soft-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-heading font-bold text-ink-primary mb-1">
        {title}
      </h3>
      <p className="text-sm text-ink-secondary max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
