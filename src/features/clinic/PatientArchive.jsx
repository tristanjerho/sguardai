import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Clock,
  FileImage,
  FolderArchive,
  Search,
  X,
  Eye,
  ExternalLink,
  Calendar,
  Activity,
  ShieldAlert,
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Printer,
  Download,
  History,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  patientService,
  INACTIVITY_THRESHOLD_DAYS,
  toTimestampMs,
} from '../../services/patientService';
import { appointmentService } from '../../services/appointmentService';
import { treatmentService } from '../../services/treatmentService';
import { StatCard } from '../../components/charts/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatPatientId } from '../../lib/formatters';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_INACTIVE_REASON =
  'Inactive for 1+ year — moved to historical archive (RA 10173 retention)';

export function PatientArchive() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ARCHIVED'); // 'ARCHIVED' | 'INACTIVE_1Y' | 'ALL_HISTORICAL'
  const [searchQuery, setSearchQuery] = useState('');
  const [durationFilter, setDurationFilter] = useState('ALL'); // 'ALL' | '1Y' | '2Y' | '3Y' | '5Y'
  const [dentistFilter, setDentistFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('LONGEST_INACTIVE');

  // Single Archive / Restore modals
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveReason, setArchiveReason] = useState(DEFAULT_INACTIVE_REASON);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState(DEFAULT_INACTIVE_REASON);
  const [actionBusy, setActionBusy] = useState(false);

  // Read-only Historical Dossier Modal
  const [dossierPatient, setDossierPatient] = useState(null);
  const [dossierTab, setDossierTab] = useState('INFO'); // 'INFO' | 'DOCUMENTS' | 'HISTORY'
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState({
    appointments: [],
    treatment: null,
    documents: [],
  });
  const [previewDoc, setPreviewDoc] = useState(null);

  const loadArchiveData = useCallback(async () => {
    try {
      setLoading(true);
      const list = await patientService.listArchiveOverview(INACTIVITY_THRESHOLD_DAYS);
      setPatients(list || []);
    } catch (err) {
      console.error('Failed to load patient archive overview:', err);
      toast.error('Unable to load patient archive records.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadArchiveData();
  }, [loadArchiveData]);

  // Core cohorts
  const archivedPatients = useMemo(
    () => patients.filter((p) => Boolean(p.isArchived)),
    [patients]
  );

  const inactivePatients = useMemo(
    () => patients.filter((p) => Boolean(p.isInactiveEligible)),
    [patients]
  );

  const historicalPatients = useMemo(
    () => patients.filter((p) => Boolean(p.isArchived) || Boolean(p.isInactiveEligible)),
    [patients]
  );

  const totalHistoricalDocs = useMemo(
    () => historicalPatients.reduce((sum, p) => sum + (p.documentCount || 0), 0),
    [historicalPatients]
  );

  const availableDentists = useMemo(() => {
    const names = new Set();
    patients.forEach((p) => {
      if (p.assignedDentistName) names.add(p.assignedDentistName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [patients]);

  const tabs = [
    { id: 'ARCHIVED', label: 'Archived Patients', badge: archivedPatients.length },
    { id: 'INACTIVE_1Y', label: 'Inactive 1+ Year', badge: inactivePatients.length },
    { id: 'ALL_HISTORICAL', label: 'All Historical', badge: historicalPatients.length },
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    durationFilter !== 'ALL' ||
    dentistFilter !== 'ALL' ||
    sortBy !== 'LONGEST_INACTIVE';

  const clearFilters = () => {
    setSearchQuery('');
    setDurationFilter('ALL');
    setDentistFilter('ALL');
    setSortBy('LONGEST_INACTIVE');
  };

  const filteredRecords = useMemo(() => {
    const baseList =
      activeTab === 'ARCHIVED'
        ? archivedPatients
        : activeTab === 'INACTIVE_1Y'
          ? inactivePatients
          : historicalPatients;

    const query = searchQuery.trim().toLowerCase();

    const matches = baseList.filter((p) => {
      // Duration filter
      const days = p.daysSinceLastVisit ?? -1;
      if (durationFilter === '1Y' && days < 365) return false;
      if (durationFilter === '2Y' && days < 730) return false;
      if (durationFilter === '3Y' && days < 1095) return false;
      if (durationFilter === '5Y' && days < 1825) return false;

      // Dentist filter
      if (dentistFilter !== 'ALL') {
        if (dentistFilter === 'UNASSIGNED') {
          if (p.assignedDentistName || p.assignedDentistId) return false;
        } else if (p.assignedDentistName !== dentistFilter) {
          return false;
        }
      }

      // Text search
      if (query) {
        const searchable = [
          p.fullName,
          formatPatientId(p),
          p.id,
          p.email,
          p.phone,
          p.archivedReason,
          p.assignedDentistName,
          p.latestProcedure,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchable.includes(query)) return false;
      }

      return true;
    });

    const sorted = [...matches];
    if (sortBy === 'LONGEST_INACTIVE') {
      sorted.sort((a, b) => (b.daysSinceLastVisit ?? -1) - (a.daysSinceLastVisit ?? -1));
    } else if (sortBy === 'RECENTLY_ARCHIVED') {
      sorted.sort(
        (a, b) => (toTimestampMs(b.archivedAt) || 0) - (toTimestampMs(a.archivedAt) || 0)
      );
    } else if (sortBy === 'MOST_DOCS') {
      sorted.sort((a, b) => (b.documentCount || 0) - (a.documentCount || 0));
    } else if (sortBy === 'NAME_AZ') {
      sorted.sort((a, b) =>
        (a.fullName || '').localeCompare(b.fullName || '', undefined, { sensitivity: 'base' })
      );
    }
    return sorted;
  }, [
    activeTab,
    archivedPatients,
    inactivePatients,
    historicalPatients,
    searchQuery,
    durationFilter,
    dentistFilter,
    sortBy,
  ]);

  // Open read-only Historical Dossier modal & load full documents + visits
  const openDossier = async (patient) => {
    setDossierPatient(patient);
    setDossierTab('INFO');
    setDossierLoading(true);
    setDossierData({ appointments: [], treatment: null, documents: [] });

    try {
      const [appts, trt, docs] = await Promise.all([
        appointmentService.listForPatient(patient.id).catch(() => []),
        treatmentService.getByPatientId(patient.id).catch(() => null),
        patientService.getRecords(patient.id).catch(() => []),
      ]);
      setDossierData({
        appointments: appts || [],
        treatment: trt || null,
        documents: docs || [],
      });
    } catch (err) {
      console.error('Failed to load archived patient dossier:', err);
      toast.error('Some historical records could not be loaded.');
    } finally {
      setDossierLoading(false);
    }
  };

  // Single patient archive
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setActionBusy(true);
    try {
      const actorName = user?.fullName || user?.name || 'Attending Dentist';
      const actorId = user?.id || user?.uid || 'dentist';
      const reason = archiveReason.trim() || DEFAULT_INACTIVE_REASON;
      await patientService.archivePatient(archiveTarget.id, reason, actorName, actorId);
      toast.success(`${archiveTarget.fullName || 'Patient'} moved to Patient Archive.`);
      setArchiveTarget(null);
      await loadArchiveData();
      if (dossierPatient?.id === archiveTarget.id) {
        setDossierPatient((prev) =>
          prev
            ? {
                ...prev,
                isArchived: true,
                archivedReason: reason,
                archivedBy: actorName,
                archivedAt: new Date().toISOString(),
              }
            : null
        );
      }
    } catch (err) {
      console.error('Archive error:', err);
      toast.error(err?.message || 'Failed to archive patient record.');
    } finally {
      setActionBusy(false);
    }
  };

  // Restore archived patient
  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    setActionBusy(true);
    try {
      const actorName = user?.fullName || user?.name || 'Attending Dentist';
      const actorId = user?.id || user?.uid || 'dentist';
      await patientService.restorePatient(restoreTarget.id, actorName, actorId);
      toast.success(`${restoreTarget.fullName || 'Patient'} restored to Active Directory.`);
      setRestoreTarget(null);
      await loadArchiveData();
      if (dossierPatient?.id === restoreTarget.id) {
        setDossierPatient((prev) => (prev ? { ...prev, isArchived: false } : null));
      }
    } catch (err) {
      console.error('Restore error:', err);
      toast.error(err?.message || 'Failed to restore patient record.');
    } finally {
      setActionBusy(false);
    }
  };

  // Bulk archive all 1+ year inactive patients
  const handleConfirmBulkArchive = async () => {
    if (inactivePatients.length === 0) return;
    setActionBusy(true);
    try {
      const actorName = user?.fullName || user?.name || 'Attending Dentist';
      const actorId = user?.id || user?.uid || 'dentist';
      const ids = inactivePatients.map((p) => p.id);
      const { succeeded, failed } = await patientService.archivePatientsBulk(
        ids,
        bulkReason.trim() || DEFAULT_INACTIVE_REASON,
        actorName,
        actorId
      );

      if (succeeded.length > 0) {
        toast.success(
          `Archived ${succeeded.length} inactive ${succeeded.length === 1 ? 'patient' : 'patients'}.`
        );
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} record(s) could not be archived.`);
      }
      setIsBulkArchiveOpen(false);
      setActiveTab('ARCHIVED');
      await loadArchiveData();
    } catch (err) {
      console.error('Bulk archive failed:', err);
      toast.error(err?.message || 'Bulk archive failed.');
    } finally {
      setActionBusy(false);
    }
  };

  // Printable summary of archived patient dossier (HTML-escaped)
  const handlePrintDossier = () => {
    if (!dossierPatient) return;
    const p = dossierPatient;
    const apptsHtml =
      dossierData.appointments.length > 0
        ? dossierData.appointments
            .map(
              (a) => `
                <tr>
                  <td>${escapeHtml(a.date || formatDate(a.createdAt))}</td>
                  <td>${escapeHtml(a.procedureName || a.serviceName || 'Dental Consultation')}</td>
                  <td>${escapeHtml(a.dentistName || 'Clinic Dentist')}</td>
                  <td>${escapeHtml(a.status || 'RECORDED')}</td>
                  <td>${escapeHtml(a.notes || '—')}</td>
                </tr>`
            )
            .join('')
        : '<tr><td colspan="5">No past appointment records.</td></tr>';

    const docsHtml =
      dossierData.documents.length > 0
        ? dossierData.documents
            .map(
              (d) => `
                <li>
                  <strong>${escapeHtml(d.type || 'IMAGE')}</strong>
                  (${escapeHtml(formatDate(d.createdAt))})
                  ${d.toothNumbers?.length ? ` — Teeth: ${escapeHtml(d.toothNumbers.join(', '))}` : ''}
                  ${d.notes ? ` — ${escapeHtml(d.notes)}` : ''}
                </li>`
            )
            .join('')
        : '<li>No radiographs or documents stored.</li>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Archived Patient Summary - ${escapeHtml(p.fullName || formatPatientId(p))}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; line-height: 1.5; }
    h1 { color: #0f766e; margin-bottom: 4px; font-size: 22px; }
    h2 { color: #0f766e; font-size: 15px; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    ul { font-size: 12px; padding-left: 18px; }
  </style>
</head>
<body>
  <h1>SmileGuard AI — Historical Patient Archive Summary</h1>
  <div class="meta">
    Generated ${escapeHtml(new Date().toLocaleString())} • Printed by ${escapeHtml(user?.fullName || 'Attending Dentist')}
  </div>
  <h2>Patient Profile &amp; Archive Status</h2>
  <div class="grid">
    <div><strong>Name:</strong> ${escapeHtml(p.fullName || 'N/A')}</div>
    <div><strong>Patient ID:</strong> ${escapeHtml(formatPatientId(p))}</div>
    <div><strong>Status:</strong> ${p.isArchived ? 'Archived Record' : 'Inactive 1+ Year'}</div>
    <div><strong>Last Clinic Activity:</strong> ${escapeHtml(p.lastVisitDate ? formatDate(p.lastVisitDate) : 'Unknown')} (${escapeHtml(p.inactivityLabel)})</div>
    <div><strong>Email:</strong> ${escapeHtml(p.email || 'N/A')}</div>
    <div><strong>Phone:</strong> ${escapeHtml(p.phone || 'N/A')}</div>
    <div><strong>Date of Birth:</strong> ${escapeHtml(p.dateOfBirth || p.dob || 'N/A')}</div>
    <div><strong>Attending Dentist:</strong> ${escapeHtml(p.assignedDentistName || 'Unassigned')}</div>
    <div><strong>Medical Conditions:</strong> ${escapeHtml(p.medicalHistory || p.medicalConditions || 'None recorded')}</div>
    <div><strong>Allergies:</strong> ${escapeHtml(p.allergies || 'None recorded')}</div>
    <div><strong>Archive Reason:</strong> ${escapeHtml(p.archivedReason || '1+ Year Inactivity')}</div>
    <div><strong>Archived By:</strong> ${escapeHtml(p.archivedBy || '—')}</div>
  </div>
  <h2>Past Appointments (${dossierData.appointments.length})</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Procedure</th><th>Dentist</th><th>Status</th><th>Notes</th></tr>
    </thead>
    <tbody>${apptsHtml}</tbody>
  </table>
  <h2>Stored Radiographs &amp; Documents (${dossierData.documents.length})</h2>
  <ul>${docsHtml}</ul>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    } else {
      document.body.removeChild(iframe);
      toast.error('Unable to open print preview.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-header-text">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
              <FolderArchive className="w-3.5 h-3.5" />
              1-Year Inactivity Retention Vault
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Patient Archive
          </h2>
          <p className="text-sm text-ink-secondary">
            Access past clinical records, medical history, and radiographs for archived patients or anyone who hasn&apos;t visited the clinic for 1 year or more.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
          <Link to="/clinic/patients">
            <Button variant="secondary" size="sm" leftIcon={Users}>
              Patient Directory
            </Button>
          </Link>
          {inactivePatients.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={Archive}
              onClick={() => {
                setBulkReason(DEFAULT_INACTIVE_REASON);
                setIsBulkArchiveOpen(true);
              }}
            >
              Archive Inactive ({inactivePatients.length})
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Archived Patients"
          value={archivedPatients.length}
          subtitle="Formally moved to archive"
          icon={Archive}
          color="teal"
        />
        <StatCard
          title="Inactive 1+ Year"
          value={inactivePatients.length}
          subtitle="Active charts eligible to archive"
          icon={Clock}
          color="orange"
          trend={inactivePatients.length > 0 ? 'Needs review' : 'Up to date'}
          trendDirection={inactivePatients.length > 0 ? 'down' : 'up'}
        />
        <StatCard
          title="Past Documents & X-Rays"
          value={totalHistoricalDocs}
          subtitle="Preserved across historical files"
          icon={FileImage}
          color="blue"
        />
      </div>

      {/* Auto-Flagged 1-Year Inactivity Banner */}
      {!loading && inactivePatients.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <strong>
                {inactivePatients.length} active{' '}
                {inactivePatients.length === 1 ? 'patient has' : 'patients have'} not visited the clinic in 1 year or more
              </strong>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Review their past charts below or archive them in one click. All past medical notes, visits, and X-rays remain permanently searchable and restorable.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('INACTIVE_1Y')}
            >
              Review Flagged
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={Archive}
              onClick={() => {
                setBulkReason(DEFAULT_INACTIVE_REASON);
                setIsBulkArchiveOpen(true);
              }}
            >
              Archive All ({inactivePatients.length})
            </Button>
          </div>
        </div>
      )}

      {/* Archive View Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Search & Filter Controls */}
      <Card className="p-3.5 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-2 lg:col-span-5 relative">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient name, ID, email, phone, or archive reason..."
              leftIcon={Search}
              aria-label="Search archived patients"
              className={searchQuery ? 'pr-9' : ''}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="lg:col-span-2">
            <Select
              aria-label="Filter by inactivity duration"
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Any Duration' },
                { value: '1Y', label: '1+ Year Inactive' },
                { value: '2Y', label: '2+ Years Inactive' },
                { value: '3Y', label: '3+ Years Inactive' },
                { value: '5Y', label: '5+ Years Inactive' },
              ]}
            />
          </div>

          <div className="lg:col-span-3">
            <Select
              aria-label="Filter by attending dentist"
              value={dentistFilter}
              onChange={(e) => setDentistFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Attending Dentists' },
                ...availableDentists.map((name) => ({ value: name, label: name })),
                { value: 'UNASSIGNED', label: 'Unassigned Files' },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <Select
              aria-label="Sort archived patients"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={[
                { value: 'LONGEST_INACTIVE', label: 'Longest Inactive' },
                { value: 'RECENTLY_ARCHIVED', label: 'Recently Archived' },
                { value: 'MOST_DOCS', label: 'Most Documents' },
                { value: 'NAME_AZ', label: 'Patient (A–Z)' },
              ]}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <span>
              Showing <strong className="text-ink-primary">{filteredRecords.length}</strong>{' '}
              {filteredRecords.length === 1 ? 'record' : 'records'}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </Card>

      {/* Records List */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          icon={FolderArchive}
          title={
            hasActiveFilters
              ? 'No matching archive records'
              : activeTab === 'INACTIVE_1Y'
                ? 'No active patients inactive for 1+ year'
                : 'No archived patient records yet'
          }
          description={
            hasActiveFilters
              ? 'Try adjusting your search keywords, inactivity threshold, or dentist filter.'
              : activeTab === 'INACTIVE_1Y'
                ? 'All active patients have recorded clinic activity within the past 12 months.'
                : 'Patients archived manually or flagged after 1+ year of clinic inactivity will appear here with all their past charts and documents.'
          }
          actionLabel={hasActiveFilters ? 'Clear Filters' : 'Open Patient Directory'}
          onAction={hasActiveFilters ? clearFilters : () => navigate('/clinic/patients')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRecords.map((pat) => {
            const years = pat.yearsSinceLastVisit;
            return (
              <Card
                key={pat.id}
                className="p-4 sm:p-5 hover:border-teal-500/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <Avatar name={pat.fullName || pat.email} size="md" className="shrink-0 mt-0.5" />

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-bold text-base text-ink-primary break-words">
                        {pat.fullName || 'Unnamed Patient'}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
                        {formatPatientId(pat)}
                      </span>
                      {pat.isArchived ? (
                        <Badge variant="warning" size="sm">
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Inactive {years !== null && years >= 1 ? `${Math.floor(years)}+ yr` : '1+ yr'}
                        </Badge>
                      )}
                      {pat.recordStatus === 'FINALIZED' && (
                        <Badge variant="success" size="sm">
                          Finalized Chart
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Last Visit:{' '}
                        <strong className="text-ink-primary">
                          {pat.lastVisitDate ? formatDate(pat.lastVisitDate) : 'Unknown'}
                        </strong>{' '}
                        <span className="text-ink-muted">({pat.inactivityLabel})</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        {pat.visitCount || 0} {pat.visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileImage className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                        <strong className="text-ink-primary">{pat.documentCount || 0}</strong>{' '}
                        {pat.documentCount === 1 ? 'document / X-ray' : 'documents / X-rays'}
                      </span>
                      {pat.assignedDentistName && (
                        <span>
                          Dentist:{' '}
                          <strong className="text-ink-primary">{pat.assignedDentistName}</strong>
                        </span>
                      )}
                    </div>

                    {pat.isArchived && pat.archivedReason && (
                      <p className="text-xs text-ink-muted break-words">
                        <span className="font-semibold text-ink-secondary">Archive Note:</span>{' '}
                        {pat.archivedReason}
                        {pat.archivedAt ? ` • Archived ${formatDate(pat.archivedAt)}` : ''}
                        {pat.archivedBy ? ` by ${pat.archivedBy}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={Eye}
                    onClick={() => openDossier(pat)}
                  >
                    Past Info &amp; Docs
                  </Button>

                  <Link to={`/clinic/patients/${pat.id}`}>
                    <Button variant="outline" size="sm" rightIcon={ExternalLink}>
                      Full Chart
                    </Button>
                  </Link>

                  {pat.isArchived ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={ArchiveRestore}
                      onClick={() => setRestoreTarget(pat)}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={Archive}
                      onClick={() => {
                        setArchiveTarget(pat);
                        setArchiveReason(DEFAULT_INACTIVE_REASON);
                      }}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          READ-ONLY HISTORICAL PATIENT DOSSIER MODAL (Past Info & Documents)
         ==================================================================== */}
      <Modal
        isOpen={Boolean(dossierPatient)}
        onClose={() => {
          setDossierPatient(null);
          setPreviewDoc(null);
        }}
        title={
          dossierPatient
            ? `Historical Dossier — ${dossierPatient.fullName || formatPatientId(dossierPatient)}`
            : 'Historical Dossier'
        }
        size="xl"
      >
        {dossierPatient && (
          <div className="space-y-5">
            {/* Archive Banner inside Dossier */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                    {formatPatientId(dossierPatient)}
                  </span>
                  <Badge variant={dossierPatient.isArchived ? 'warning' : 'danger'} size="sm">
                    {dossierPatient.isArchived ? 'Archived Record (Read-Only)' : 'Inactive 1+ Year'}
                  </Badge>
                </div>
                <p className="text-xs text-ink-secondary">
                  Last clinic activity:{' '}
                  <strong className="text-ink-primary">
                    {dossierPatient.lastVisitDate
                      ? formatDate(dossierPatient.lastVisitDate)
                      : 'Unknown'}
                  </strong>{' '}
                  ({dossierPatient.inactivityLabel})
                  {dossierPatient.archivedReason ? ` • ${dossierPatient.archivedReason}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={Printer}
                  onClick={handlePrintDossier}
                >
                  Print Summary
                </Button>
                <Link to={`/clinic/patients/${dossierPatient.id}`}>
                  <Button variant="secondary" size="sm" rightIcon={ExternalLink}>
                    Open Full Chart
                  </Button>
                </Link>
                {dossierPatient.isArchived ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={ArchiveRestore}
                    onClick={() => setRestoreTarget(dossierPatient)}
                  >
                    Restore to Active
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={Archive}
                    onClick={() => {
                      setArchiveTarget(dossierPatient);
                      setArchiveReason(DEFAULT_INACTIVE_REASON);
                    }}
                  >
                    Archive Now
                  </Button>
                )}
              </div>
            </div>

            {/* Inner Dossier Tabs */}
            <Tabs
              tabs={[
                { id: 'INFO', label: 'Past Information & Medical History' },
                {
                  id: 'DOCUMENTS',
                  label: 'Past Documents & X-Rays',
                  badge: dossierData.documents.length,
                },
                {
                  id: 'HISTORY',
                  label: 'Past Visits & Treatments',
                  badge: dossierData.appointments.length,
                },
              ]}
              activeTab={dossierTab}
              onChange={setDossierTab}
            />

            {dossierLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton variant="card" count={2} />
              </div>
            ) : dossierTab === 'INFO' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Demographics & Contact */}
                  <div className="p-4 rounded-xl border border-surface-border bg-surface-50/60 dark:bg-surface-100/20 space-y-2.5 text-xs sm:text-sm">
                    <h4 className="font-heading font-bold text-ink-primary flex items-center gap-2">
                      <User className="w-4 h-4 text-teal-600" />
                      Demographics &amp; Contact
                    </h4>
                    <div className="space-y-1.5 text-ink-secondary">
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        <span>{dossierPatient.email || 'No email on file'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        <span>{dossierPatient.phone || 'No phone on file'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        <span>{dossierPatient.address || 'No address recorded'}</span>
                      </p>
                      <p>
                        <strong className="text-ink-primary">Date of Birth:</strong>{' '}
                        {dossierPatient.dateOfBirth || dossierPatient.dob || 'Not recorded'}
                      </p>
                      <p>
                        <strong className="text-ink-primary">Emergency Contact:</strong>{' '}
                        {dossierPatient.emergencyContactName ||
                          dossierPatient.emergencyContact?.name ||
                          (typeof dossierPatient.emergencyContact === 'string'
                            ? dossierPatient.emergencyContact
                            : 'Not recorded')}
                        {dossierPatient.emergencyContactPhone ||
                        dossierPatient.emergencyContact?.phone
                          ? ` (${dossierPatient.emergencyContactPhone || dossierPatient.emergencyContact?.phone})`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* Medical & Clinical Profile */}
                  <div className="p-4 rounded-xl border border-surface-border bg-surface-50/60 dark:bg-surface-100/20 space-y-2.5 text-xs sm:text-sm">
                    <h4 className="font-heading font-bold text-ink-primary flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      Medical History &amp; Alerts
                    </h4>
                    <div className="space-y-1.5 text-ink-secondary">
                      <p>
                        <strong className="text-ink-primary">Allergies:</strong>{' '}
                        {dossierPatient.allergies || 'None recorded'}
                      </p>
                      <p>
                        <strong className="text-ink-primary">Medical Conditions:</strong>{' '}
                        {dossierPatient.medicalHistory ||
                          dossierPatient.medicalConditions ||
                          'None recorded'}
                      </p>
                      <p>
                        <strong className="text-ink-primary">Attending Dentist:</strong>{' '}
                        {dossierPatient.assignedDentistName || 'Unassigned'}
                      </p>
                      <p>
                        <strong className="text-ink-primary">RA 10173 Privacy Consent:</strong>{' '}
                        {dossierPatient.privacyConsent ? 'Signed / On File' : 'Not recorded'}
                      </p>
                      <p>
                        <strong className="text-ink-primary">Registered On:</strong>{' '}
                        {dossierPatient.createdAt ? formatDate(dossierPatient.createdAt) : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Archive Audit Log */}
                <div className="p-4 rounded-xl border border-surface-border bg-surface-50/40 dark:bg-surface-100/10 space-y-2.5">
                  <h4 className="font-heading font-bold text-sm text-ink-primary flex items-center gap-2">
                    <History className="w-4 h-4 text-teal-600" />
                    Archive &amp; Retention Audit Trail
                  </h4>
                  {Array.isArray(dossierPatient.archiveAuditLog) &&
                  dossierPatient.archiveAuditLog.length > 0 ? (
                    <div className="space-y-2">
                      {dossierPatient.archiveAuditLog.map((entry, idx) => (
                        <div
                          key={`${entry.timestamp || idx}-${idx}`}
                          className="text-xs flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-card border border-surface-border/70"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              variant={entry.action === 'ARCHIVED' ? 'warning' : 'success'}
                              size="sm"
                            >
                              {entry.action}
                            </Badge>
                            <span className="text-ink-primary font-medium break-words">
                              {entry.reason || 'Status updated'}
                            </span>
                          </div>
                          <span className="text-ink-muted shrink-0">
                            {entry.by || 'Staff'} •{' '}
                            {entry.timestamp ? formatDate(entry.timestamp) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      No archive transitions logged yet for this patient.
                    </p>
                  )}
                </div>
              </div>
            ) : dossierTab === 'DOCUMENTS' ? (
              <div className="space-y-4">
                {dossierData.documents.length === 0 ? (
                  <EmptyState
                    icon={FileImage}
                    title="No past documents or radiographs"
                    description="No dental X-rays, intraoral photographs, or clinical imaging records were uploaded for this patient."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dossierData.documents.map((docItem) => {
                      const imgUrl = docItem.secureUrl || docItem.url;
                      return (
                        <div
                          key={docItem.id}
                          className="rounded-xl border border-surface-border bg-surface-card overflow-hidden flex flex-col"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(docItem)}
                            className="aspect-[4/3] w-full bg-slate-950/90 overflow-hidden flex items-center justify-center group relative"
                          >
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={docItem.type || 'Dental radiograph'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <FileImage className="w-10 h-10 text-slate-500" />
                            )}
                            <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900/80 text-white">
                              {docItem.type || 'IMAGE'}
                            </span>
                          </button>

                          <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-ink-primary">
                                {formatDate(docItem.createdAt)}
                              </p>
                              {Array.isArray(docItem.toothNumbers) &&
                                docItem.toothNumbers.length > 0 && (
                                  <p className="text-ink-secondary font-mono text-[11px]">
                                    Teeth: {docItem.toothNumbers.join(', ')}
                                  </p>
                                )}
                              {docItem.notes && (
                                <p className="text-ink-muted line-clamp-2">{docItem.notes}</p>
                              )}
                            </div>

                            {imgUrl && (
                              <div className="pt-2 flex items-center gap-2">
                                <a
                                  href={imgUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Open Full
                                </a>
                                <span className="text-surface-border">•</span>
                                <a
                                  href={imgUrl}
                                  download
                                  className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink-primary font-medium"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline High-Res Document Lightbox */}
                {previewDoc && (
                  <div className="p-4 rounded-xl border border-teal-500/40 bg-surface-50 dark:bg-surface-100/30 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs sm:text-sm font-bold text-ink-primary">
                        {previewDoc.type || 'Clinical Document'} •{' '}
                        {formatDate(previewDoc.createdAt)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(null)}
                        className="p-1 rounded-lg text-ink-muted hover:text-ink-primary"
                        aria-label="Close document preview"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <img
                      src={previewDoc.secureUrl || previewDoc.url}
                      alt={previewDoc.type || 'Preview'}
                      className="w-full max-h-[380px] object-contain rounded-lg bg-slate-950"
                    />
                    {previewDoc.notes && (
                      <p className="text-xs text-ink-secondary">{previewDoc.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Past Treatment Plan Summary */}
                {dossierData.treatment && (
                  <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 space-y-1.5 text-xs sm:text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-heading font-bold text-ink-primary flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        Treatment Plan: {dossierData.treatment.title || 'Orthodontic / Dental Plan'}
                      </h4>
                      <Badge variant="primary" size="sm">
                        {dossierData.treatment.progressPercentage ?? 0}% Complete
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      Stage: <strong>{dossierData.treatment.currentStage || 'Recorded'}</strong>
                      {dossierData.treatment.startDate
                        ? ` • Started ${formatDate(dossierData.treatment.startDate)}`
                        : ''}
                    </p>
                    {dossierData.treatment.dentistNotes && (
                      <p className="text-xs text-ink-muted">{dossierData.treatment.dentistNotes}</p>
                    )}
                  </div>
                )}

                {/* Past Appointments List */}
                {dossierData.appointments.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="No past appointments recorded"
                    description="No historical clinic visits were found for this patient."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {dossierData.appointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-3.5 rounded-xl border border-surface-border bg-surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-ink-primary">
                              {appt.procedureName || appt.serviceName || 'Dental Consultation'}
                            </span>
                            <Badge status={appt.status} size="sm">
                              {appt.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-ink-secondary">
                            {appt.date || formatDate(appt.createdAt)}
                            {appt.timeSlot ? ` • ${appt.timeSlot}` : ''}
                            {appt.dentistName ? ` • ${appt.dentistName}` : ''}
                          </p>
                          {appt.notes && (
                            <p className="text-xs text-ink-muted mt-1">{appt.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ====================================================================
          ARCHIVE SINGLE PATIENT CONFIRMATION MODAL
         ==================================================================== */}
      <Modal
        isOpen={Boolean(archiveTarget)}
        onClose={() => !actionBusy && setArchiveTarget(null)}
        title="Archive Patient Record"
        size="md"
      >
        {archiveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              Move <strong className="text-ink-primary">{archiveTarget.fullName}</strong> (
              <span className="font-mono">{formatPatientId(archiveTarget)}</span>) to the Patient
              Archive? Their past medical notes, visits, odontogram, and radiographs remain safely
              preserved and can be restored anytime.
            </p>

            <Input
              label="Archive Reason"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g., Inactive for 1+ year"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={actionBusy}
                onClick={() => setArchiveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={Archive}
                isLoading={actionBusy}
                onClick={handleConfirmArchive}
              >
                Confirm Archive
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ====================================================================
          RESTORE ARCHIVED PATIENT CONFIRMATION MODAL
         ==================================================================== */}
      <Modal
        isOpen={Boolean(restoreTarget)}
        onClose={() => !actionBusy && setRestoreTarget(null)}
        title="Restore Patient to Active Roster"
        size="md"
      >
        {restoreTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              Restore <strong className="text-ink-primary">{restoreTarget.fullName}</strong> (
              <span className="font-mono">{formatPatientId(restoreTarget)}</span>) back to the
              active Patient Directory? All historical records and audit logs will remain intact.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={actionBusy}
                onClick={() => setRestoreTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={ArchiveRestore}
                isLoading={actionBusy}
                onClick={handleConfirmRestore}
              >
                Restore Patient
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ====================================================================
          BULK ARCHIVE 1+ YEAR INACTIVE PATIENTS MODAL
         ==================================================================== */}
      <Modal
        isOpen={isBulkArchiveOpen}
        onClose={() => !actionBusy && setIsBulkArchiveOpen(false)}
        title={`Archive ${inactivePatients.length} Inactive Patient${inactivePatients.length === 1 ? '' : 's'}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            The following <strong className="text-ink-primary">{inactivePatients.length}</strong>{' '}
            active {inactivePatients.length === 1 ? 'patient has' : 'patients have'} had no clinic
            visits for <strong>1 year or more</strong>. Archiving removes them from the active
            directory while preserving all past information, X-rays, and visit logs.
          </p>

          <div className="max-h-44 overflow-y-auto rounded-xl border border-surface-border divide-y divide-surface-border/60 text-xs">
            {inactivePatients.map((p) => (
              <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-primary truncate">
                    {p.fullName || 'Unnamed Patient'}
                  </p>
                  <p className="text-ink-muted font-mono">{formatPatientId(p)}</p>
                </div>
                <span className="text-amber-700 dark:text-amber-400 font-medium shrink-0">
                  {p.inactivityLabel}
                </span>
              </div>
            ))}
          </div>

          <Input
            label="Archive Reason (Applied to Audit Log)"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder={DEFAULT_INACTIVE_REASON}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={actionBusy}
              onClick={() => setIsBulkArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={CheckCircle2}
              isLoading={actionBusy}
              onClick={handleConfirmBulkArchive}
            >
              Archive All ({inactivePatients.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
