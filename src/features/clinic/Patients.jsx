import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  ChevronRight,
  Filter,
  X,
  Archive,
  UserCheck,
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatPatientId } from '../../lib/formatters';

export function PatientsDirectory() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('ACTIVE'); // 'ACTIVE' | 'ARCHIVED' | 'ALL'
  const [dentistFilter, setDentistFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    async function loadPatients() {
      try {
        setLoading(true);
        const list = await patientService.listPatients();
        setPatients(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  // Distinct attending dentists for filter dropdown
  const availableDentists = useMemo(() => {
    const names = new Set();
    patients.forEach((p) => {
      if (p.assignedDentistName) names.add(p.assignedDentistName);
    });
    return Array.from(names);
  }, [patients]);

  // Counts for tabs
  const activeCount = useMemo(() => patients.filter((p) => !p.isArchived).length, [patients]);
  const archivedCount = useMemo(() => patients.filter((p) => Boolean(p.isArchived)).length, [patients]);

  const archiveTabs = [
    { id: 'ACTIVE', label: 'Active Patients', badge: activeCount },
    { id: 'ARCHIVED', label: 'Archived Records', badge: archivedCount },
    { id: 'ALL', label: 'All Records', badge: patients.length },
  ];

  const filteredPatients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return patients.filter((p) => {
      // 1. Archive filter
      if (archiveFilter === 'ACTIVE' && p.isArchived) return false;
      if (archiveFilter === 'ARCHIVED' && !p.isArchived) return false;

      // 2. Dentist filter
      if (dentistFilter !== 'ALL') {
        if (dentistFilter === 'UNASSIGNED') {
          if (p.assignedDentistName || p.assignedDentistId) return false;
        } else if (p.assignedDentistName !== dentistFilter) {
          return false;
        }
      }

      // 3. Search query
      if (!term) return true;
      const name = (p.fullName || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const patientId = formatPatientId(p).toLowerCase();
      const rawId = (p.id || '').toLowerCase();
      const dentist = (p.assignedDentistName || '').toLowerCase();

      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        patientId.includes(term) ||
        rawId.includes(term) ||
        dentist.includes(term)
      );
    });
  }, [patients, searchTerm, archiveFilter, dentistFilter]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const displayedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const hasActiveFilters = searchTerm || dentistFilter !== 'ALL' || archiveFilter !== 'ACTIVE';

  const clearFilters = () => {
    setSearchTerm('');
    setDentistFilter('ALL');
    setArchiveFilter('ACTIVE');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="page-header-row">
        <div className="page-header-text">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Patient Directory
          </h2>
          <p className="text-sm text-ink-secondary">
            Registered dental charts, comprehensive medical case files, and historical archives.
          </p>
        </div>

        {/* Search Input & Archive Shortcut */}
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by name, Patient ID, phone, or dentist..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-teal-500 shadow-soft-sm"
            />
          </div>
          <Link to="/clinic/archive" className="shrink-0">
            <Button variant="secondary" size="sm" leftIcon={Archive} className="w-full xs:w-auto">
              Patient Archive
            </Button>
          </Link>
        </div>
      </div>

      {/* Directory Archive Tabs & Dentist Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <Tabs
          tabs={archiveTabs}
          activeTab={archiveFilter}
          onChange={(tab) => {
            setArchiveFilter(tab);
            setCurrentPage(1);
          }}
        />

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto min-w-0">
          {/* Attending Dentist Filter */}
          <div className="flex items-center gap-1.5 bg-surface-card border border-surface-border rounded-xl px-3 py-1.5 text-xs text-ink-secondary shadow-soft-sm w-full sm:w-auto min-w-0">
            <Filter className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <select
              value={dentistFilter}
              onChange={(e) => {
                setDentistFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-0 bg-transparent text-xs text-ink-primary outline-none cursor-pointer truncate"
            >
              <option value="ALL">All Attending Dentists</option>
              {availableDentists.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned Case Files</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              leftIcon={X}
              className="text-xs text-ink-muted hover:text-ink-primary"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Patients Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredPatients.length === 0 ? (
        <EmptyState
          title="No Patient Records Found"
          description={
            hasActiveFilters
              ? 'No patients matched your current filter criteria. Try resetting your search or filters.'
              : 'There are currently no patient records registered.'
          }
          icon={Users}
          actionLabel={hasActiveFilters ? 'Reset Filter Settings' : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="table-responsive-wrap">
            <table className="w-full min-w-[460px] text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-3.5 sm:p-4 sm:pl-6">Patient</th>
                  <th className="p-3.5 sm:p-4 sm:pr-6 text-right">View Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                {displayedPatients.map((pat) => (
                  <tr
                    key={pat.id}
                    className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                  >
                    <td className="p-3.5 sm:p-4 sm:pl-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={pat.fullName || pat.email} size="sm" />
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-heading font-bold text-ink-primary text-sm break-words">
                              {pat.fullName || 'New Patient'}
                            </p>
                            {pat.isArchived && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded">
                                Archived Record
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-ink-muted break-words">
                            <span className="font-semibold text-ink-primary font-mono">
                              {formatPatientId(pat)}
                            </span>{' '}
                            • {pat.email || 'No email registered'}
                            {pat.assignedDentistName && (
                              <span className="ml-2 text-ink-secondary">
                                • Attending: <span className="font-medium text-ink-primary">{pat.assignedDentistName}</span>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 sm:p-4 sm:pr-6 text-right whitespace-nowrap">
                      <Link to={`/clinic/patients/${pat.id}`}>
                        <Button variant="secondary" size="sm" rightIcon={ChevronRight}>
                          View Chart
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3.5 sm:p-4 border-t border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs text-ink-secondary">
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length} records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
