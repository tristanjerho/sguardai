import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'teal',
}) {
  const colorMap = {
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            {value}
          </p>
        </div>

        {Icon && (
          <div className={`p-3 rounded-2xl border ${colorMap[color] || colorMap.teal}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border/50 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-bold ${
                trendDirection === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trendDirection === 'up' ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {trend}
            </span>
          )}
          {subtitle && <span className="text-ink-muted">{subtitle}</span>}
        </div>
      )}
    </Card>
  );
}
