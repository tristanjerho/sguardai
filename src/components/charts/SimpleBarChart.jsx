import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Calendar } from 'lucide-react';

export function SimpleBarChart({ data = [], xKey = 'day', valueKey = 'count' }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload || {};
      const displayTitle = item.fullDate || item.dateLabel || label;
      return (
        <div className="bg-surface-card p-3 rounded-xl border border-surface-border shadow-soft text-xs space-y-1.5 min-w-[160px]">
          <p className="font-heading font-bold text-ink-primary">{displayTitle}</p>
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-ink-secondary">Appointments:</span>
            </div>
            <span className="font-bold text-ink-primary">{payload[0].value}</span>
          </div>

          {(item.confirmed !== undefined || item.pending !== undefined) && (
            <div className="pt-1.5 border-t border-surface-border/60 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Confirmed / Done:
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {item.confirmed || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-ink-muted">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pending:
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {item.pending || 0}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-surface-border rounded-2xl bg-surface-50/40 dark:bg-surface-100/10">
        <Calendar className="w-8 h-8 text-ink-muted mb-2 opacity-50" />
        <p className="text-sm font-medium text-ink-primary">No appointments recorded</p>
        <p className="text-xs text-ink-muted mt-0.5">There are no records for this period.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
          <XAxis
            dataKey={xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-ink-muted"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-ink-muted"
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 184, 166, 0.08)' }} />
          <Bar
            dataKey={valueKey}
            fill="#0d9488"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
