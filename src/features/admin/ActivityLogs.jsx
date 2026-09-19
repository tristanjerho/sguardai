import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { activityLogService } from '../../services/activityLogService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../lib/formatters';

export function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const list = await activityLogService.list();
      setLogs(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Clinic Activity & Security Logs
          </h2>
          <p className="text-sm text-ink-secondary">
            Immutable auditable timeline of administrative actions, clinical approvals, and authentication events.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadLogs} leftIcon={RefreshCw}>
          Refresh Audit Trail
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search by actor, action type, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-base border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-ink-primary outline-none focus:border-teal-500"
          />
        </div>
      </Card>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No Logs Found"
          description="There are no activity audit logs matching your search."
          icon={ShieldAlert}
        />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-4 pl-6">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Action Event</th>
                  <th className="p-4 pr-6">Entity / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                  >
                    <td className="p-4 pl-6 text-ink-muted font-mono text-xs whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>

                    <td className="p-4 font-semibold text-ink-primary">
                      {log.actor}
                    </td>

                    <td className="p-4">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                        {log.action}
                      </span>
                    </td>

                    <td className="p-4 pr-6 text-ink-secondary">
                      {log.entity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
