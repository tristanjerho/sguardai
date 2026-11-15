import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  Check,
  AlertCircle,
  Plus,
  CalendarClock,
  RotateCcw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, formatPatientId } from '../../lib/formatters';

const PREDEFINED_DECLINE_REASONS = [
  'Dentist attending emergency / surgical procedure',
  'Double-booking scheduling conflict',
  'Pre-procedure dental X-ray / records required first',
  'Clinic equipment sterilization & operatory maintenance',
  'Patient medical clearance required',
  'Clinic closed on requested date',
  'Other operational or clinical reason',
];

const PREDEFINED_RESCHEDULE_REASONS = [
  'Dentist Schedule Adjustment / Surgery Extension',
  'Patient Requested Date & Time Shift',
  'Operatory / Specialized Equipment Preparation',
  'Inclement Weather / Transport Disturbance',
  'Pre-procedure Diagnostic Laboratory Results Pending',
  'Other Operational Reason',
];

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

export function AppointmentsQueue() {
  const { user } = useAuth();
  const toast = useToast();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dentistFilter, setDentistFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Action modals
  const [approveModalItem, setApproveModalItem] = useState(null);
  const [completeModalItem, setCompleteModalItem] = useState(null);

  // Decline Checkpoint State
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [declineCategory, setDeclineCategory] = useState(PREDEFINED_DECLINE_REASONS[0]);
  const [declineNotes, setDeclineNotes] = useState('');
  const [declineConfirmed, setDeclineConfirmed] = useState(false);

  // Reschedule Checkpoint State
  const [rescheduleModalItem, setRescheduleModalItem] = useState(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [newRescheduleSlot, setNewRescheduleSlot] = useState(TIME_SLOTS[0]);
  const [rescheduleReasonCategory, setRescheduleReasonCategory] = useState(PREDEFINED_RESCHEDULE_REASONS[0]);
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleConfirmed, setRescheduleConfirmed] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = appointmentService.subscribeToAppointments((list) => {
      setAppointments(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenReschedule = (apt) => {
    setRescheduleModalItem(apt);
    setNewRescheduleDate(apt.date || '');
    setNewRescheduleSlot(apt.timeSlot || TIME_SLOTS[0]);
    setRescheduleReasonCategory(PREDEFINED_RESCHEDULE_REASONS[0]);
    setRescheduleNotes('');
    setRescheduleConfirmed(false);
  };

  const handleOpenDecline = (apt) => {
    setRejectModalItem(apt);
    setDeclineCategory(PREDEFINED_DECLINE_REASONS[0]);
    setDeclineNotes('');
    setDeclineConfirmed(false);
  };

  const handleApprove = async () => {
    if (!approveModalItem) return;
    setIsProcessing(true);
    try {
      await appointmentService.updateStatus(
        approveModalItem.id,
        'CONFIRMED',
        '',
        user.fullName || user.name || 'Dentist'
      );
      toast.success(`Confirmed appointment for ${approveModalItem.patientName}. Patient has been notified.`);
      setApproveModalItem(null);
    } catch (err) {
      toast.error(err.message || 'Failed to approve appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalItem) return;
    if (!declineConfirmed) {
      toast.error('Please confirm the decline checkpoint acknowledgment before proceeding.');
      return;
    }
    const combinedReason = `${declineCategory}${declineNotes.trim() ? ` — Notes: ${declineNotes.trim()}` : ''}`;
    setIsProcessing(true);
    try {
      await appointmentService.updateStatus(
        rejectModalItem.id,
        'REJECTED',
        combinedReason,
        user.fullName || user.displayName || user.email || 'Attending Dentist',
        {
          category: declineCategory,
          notes: declineNotes.trim(),
          declinedBy: user.fullName || user.displayName || 'Attending Dentist',
        }
      );
      toast.success(`Declined appointment for ${rejectModalItem.patientName}. Audit record logged.`);
      setRejectModalItem(null);
      setDeclineNotes('');
      setDeclineConfirmed(false);
    } catch (err) {
      toast.error(err.message || 'Failed to decline appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleModalItem) return;
    if (!newRescheduleDate) {
      toast.error('Please select a new appointment date.');
      return;
    }
    if (!newRescheduleSlot) {
      toast.error('Please select a valid time slot.');
      return;
    }
    if (!rescheduleConfirmed) {
      toast.error('Please confirm the rescheduling checkpoint acknowledgment before saving.');
      return;
    }
    const fullRescheduleReason = `${rescheduleReasonCategory}${rescheduleNotes.trim() ? ` — Notes: ${rescheduleNotes.trim()}` : ''}`;
    setIsProcessing(true);
    try {
      await appointmentService.reschedule(
        rescheduleModalItem.id,
        newRescheduleDate,
        newRescheduleSlot,
        rescheduleModalItem.dentistId,
        user.fullName || user.displayName || user.email || 'Attending Dentist',
        fullRescheduleReason
      );
      toast.success(`Rescheduled appointment for ${rescheduleModalItem.patientName} to ${formatDate(newRescheduleDate)} at ${newRescheduleSlot}. Patient notified.`);
      setRescheduleModalItem(null);
      setRescheduleConfirmed(false);
    } catch (err) {
      toast.error(err.message || 'Failed to reschedule appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!completeModalItem) return;
    setIsProcessing(true);
    try {
      await appointmentService.updateStatus(
        completeModalItem.id,
        'COMPLETED',
        '',
        user.fullName || user.name || 'Dentist'
      );
      toast.success(`Appointment marked as completed.`);
      setCompleteModalItem(null);
    } catch (err) {
      toast.error(err.message || 'Failed to complete appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Unique attending dentists for multi-dentist filtering
  const availableDentists = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      if (a.dentistName) set.add(a.dentistName);
    });
    return Array.from(set);
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return appointments.filter((apt) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'RESCHEDULED') {
          if (!apt.rescheduleHistory || apt.rescheduleHistory.length === 0) return false;
        } else if (apt.status !== statusFilter) {
          return false;
        }
      }

      // 2. Dentist Filter
      if (dentistFilter !== 'ALL') {
        if (apt.dentistName !== dentistFilter && apt.dentistId !== dentistFilter) {
          return false;
        }
      }

      // 3. Date Range Filter
      if (fromDate && apt.date < fromDate) return false;
      if (toDate && apt.date > toDate) return false;

      // 4. Combined Search
      if (!term) return true;
      const pName = (apt.patientName || '').toLowerCase();
      const pCode = formatPatientId(apt.patientId || apt.id).toLowerCase();
      const sName = (apt.serviceName || '').toLowerCase();
      const dName = (apt.dentistName || '').toLowerCase();
      const notes = (apt.notes || '').toLowerCase();

      return (
        pName.includes(term) ||
        pCode.includes(term) ||
        sName.includes(term) ||
        dName.includes(term) ||
        notes.includes(term)
      );
    });
  }, [appointments, searchTerm, statusFilter, dentistFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage) || 1;
  const displayedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const hasActiveFilters = Boolean(
    searchTerm ||
    statusFilter !== 'ALL' ||
    dentistFilter !== 'ALL' ||
    fromDate ||
    toDate
  );

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDentistFilter('ALL');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const statusTabs = [
    { id: 'ALL', label: 'All Requests', badge: appointments.length },
    {
      id: 'PENDING',
      label: 'Pending Approvals',
      badge: appointments.filter((a) => a.status === 'PENDING').length,
    },
    {
      id: 'CONFIRMED',
      label: 'Confirmed',
      badge: appointments.filter((a) => a.status === 'CONFIRMED').length,
    },
    {
      id: 'COMPLETED',
      label: 'Completed',
      badge: appointments.filter((a) => a.status === 'COMPLETED').length,
    },
    {
      id: 'CANCELLED',
      label: 'Cancelled',
      badge: appointments.filter((a) => a.status === 'CANCELLED').length,
    },
    {
      id: 'REJECTED',
      label: 'Declined',
      badge: appointments.filter((a) => a.status === 'REJECTED').length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Appointments & Patient Queue
        </h2>
        <p className="text-sm text-ink-secondary">
          Review patient booking requests, approve schedules, and track daily clinical arrivals across all clinic dentists.
        </p>
      </div>

      <Tabs
        tabs={statusTabs}
        activeTab={statusFilter}
        onChange={(tab) => {
          setStatusFilter(tab);
          setCurrentPage(1);
        }}
      />

      {/* Multi-Criteria Search & Filter Bar */}
      <Card className="p-4 shadow-soft-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by patient name, ID, procedure, or dentist..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-surface-base border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-teal-500"
            />
          </div>

          {/* Assigned Dentist Filter */}
          <div className="flex items-center gap-1.5 bg-surface-base border border-surface-border rounded-xl px-3 py-2 text-xs text-ink-secondary min-w-0 lg:max-w-[240px]">
            <User className="w-3.5 h-3.5 text-ink-muted shrink-0" />
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
            </select>
          </div>

          {/* Date Range: From -> To */}
          <div className="flex flex-col xs:flex-row xs:items-center gap-2 w-full lg:w-auto">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-surface-base border border-surface-border rounded-xl px-3 py-1.5 text-xs">
              <span className="text-[11px] text-ink-muted uppercase font-bold shrink-0">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs text-ink-primary outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-surface-base border border-surface-border rounded-xl px-3 py-1.5 text-xs">
              <span className="text-[11px] text-ink-muted uppercase font-bold shrink-0">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 bg-transparent text-xs text-ink-primary outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Clear Filter Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              leftIcon={X}
              className="text-xs text-ink-muted hover:text-ink-primary self-center lg:self-auto"
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Queue Table List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="rectangular" className="h-28" count={4} />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          title="No Appointments Found"
          description="There are no appointments matching your current search or filter criteria."
          icon={Calendar}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {displayedAppointments.map((apt) => (
            <Card key={apt.id} className="p-5 sm:p-6 transition-all hover:border-teal-300">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-ink-primary">
                      {apt.patientName}
                    </h3>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                      {apt.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                    {apt.serviceName}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
                    <span className="flex items-center gap-1 font-semibold text-ink-primary">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      {formatDate(apt.date)}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-ink-primary">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      {apt.timeSlot}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-ink-muted" />
                      Assigned: {apt.dentistName}
                    </span>
                  </div>

                  {apt.notes && (
                    <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border text-xs text-ink-secondary">
                      <strong className="text-ink-primary">Patient Complaint/Notes:</strong> &ldquo;{apt.notes}&rdquo;
                    </div>
                  )}

                  {apt.rejectionReason && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Declined ({apt.declinedCategory || 'Scheduling Reason'}):</span>
                      </div>
                      <p>{apt.declinedNotes || apt.rejectionReason}</p>
                      {apt.declinedBy && (
                        <p className="text-[11px] text-ink-muted">
                          Logged by: {apt.declinedBy} {apt.declinedAt ? `• ${new Date(apt.declinedAt).toLocaleString()}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {apt.rescheduleHistory && apt.rescheduleHistory.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink-secondary space-y-1">
                      <span className="font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Reschedule Audit History:
                      </span>
                      {apt.rescheduleHistory.slice(-2).map((rh, idx) => (
                        <p key={idx} className="text-[11px] text-ink-muted">
                          Moved from {rh.previousDate} ({rh.previousTimeSlot}) to {rh.newDate} ({rh.newTimeSlot}) by {rh.rescheduledBy}. Reason: {rh.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-surface-border">
                  {apt.status === 'PENDING' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setApproveModalItem(apt)}
                        leftIcon={Check}
                      >
                        Approve Booking
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReschedule(apt)}
                        leftIcon={CalendarClock}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenDecline(apt)}
                        leftIcon={XCircle}
                      >
                        Decline
                      </Button>
                    </>
                  )}

                  {apt.status === 'CONFIRMED' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setCompleteModalItem(apt)}
                        leftIcon={CheckCircle2}
                      >
                        Mark Completed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReschedule(apt)}
                        leftIcon={CalendarClock}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenDecline(apt)}
                        leftIcon={XCircle}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-card border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs text-ink-secondary shadow-soft-sm">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredAppointments.length)} of {filteredAppointments.length} appointments
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
      </>
    )}

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={!!approveModalItem}
        onClose={() => setApproveModalItem(null)}
        title="Confirm Patient Appointment"
        description="Confirm and lock in the scheduled appointment slot for this patient."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 space-y-1">
            <p><strong>Patient:</strong> {approveModalItem?.patientName}</p>
            <p><strong>Procedure:</strong> {approveModalItem?.serviceName}</p>
            <p><strong>Date & Time:</strong> {formatDate(approveModalItem?.date)} at {approveModalItem?.timeSlot}</p>
            <p><strong>Assigned Doctor:</strong> {approveModalItem?.dentistName}</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setApproveModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isProcessing}
              onClick={handleApprove}
            >
              Approve & Notify Patient
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decline Checkpoint Modal */}
      <Modal
        isOpen={!!rejectModalItem}
        onClose={() => {
          setRejectModalItem(null);
          setDeclineNotes('');
          setDeclineConfirmed(false);
        }}
        title="Decline Appointment Request"
        description="Panelist Checkpoint: Select a standardized reason and confirm clinical sign-off."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs space-y-1">
            <p><strong>Patient:</strong> {rejectModalItem?.patientName}</p>
            <p><strong>Scheduled Slot:</strong> {formatDate(rejectModalItem?.date)} at {rejectModalItem?.timeSlot}</p>
            <p><strong>Procedure:</strong> {rejectModalItem?.serviceName}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Predefined Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={declineCategory}
              onChange={(e) => setDeclineCategory(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-rose-500"
            >
              {PREDEFINED_DECLINE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Additional Practitioner Notes (Optional)
            </label>
            <textarea
              value={declineNotes}
              onChange={(e) => setDeclineNotes(e.target.value)}
              rows={2}
              placeholder="e.g., Recommended shifting to Tuesday afternoon after surgical slot..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-xs outline-none focus:border-rose-500 resize-none text-ink-primary"
            />
          </div>

          {/* Mandatory Checkpoint Confirmation */}
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="declineConfirmationCheckbox"
              checked={declineConfirmed}
              onChange={(e) => setDeclineConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-rose-600 border-surface-border focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="declineConfirmationCheckbox" className="text-xs text-rose-900 dark:text-rose-200 cursor-pointer leading-snug">
              <strong>Decline Checkpoint Confirmation:</strong> I confirm this decline action will notify {rejectModalItem?.patientName}, log my practitioner signature ({user?.fullName || 'Dentist'}), and preserve the audit trail in the clinic history.
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setRejectModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isProcessing}
              disabled={!declineConfirmed}
              onClick={handleReject}
            >
              Confirm Decline & Notify Patient
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Checkpoint Modal */}
      <Modal
        isOpen={!!rescheduleModalItem}
        onClose={() => {
          setRescheduleModalItem(null);
          setRescheduleConfirmed(false);
        }}
        title="Reschedule Appointment"
        description="Panelist Checkpoint: Reassign appointment slot with conflict validation and audit preservation."
      >
        <div className="space-y-4">
          {/* Side by side schedule comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-surface-border space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Original Schedule</span>
              <p className="font-bold text-ink-primary">{rescheduleModalItem?.patientName}</p>
              <p className="text-ink-secondary">{formatDate(rescheduleModalItem?.date)} at {rescheduleModalItem?.timeSlot}</p>
              <p className="text-ink-muted text-[11px]">{rescheduleModalItem?.dentistName}</p>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Proposed New Schedule</span>
              <p className="font-bold text-teal-900 dark:text-teal-200">{rescheduleModalItem?.patientName}</p>
              <p className="text-teal-800 dark:text-teal-300">{newRescheduleDate ? formatDate(newRescheduleDate) : 'Select date'} at {newRescheduleSlot}</p>
              <p className="text-teal-700 dark:text-teal-400 text-[11px]">{rescheduleModalItem?.dentistName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                New Date <span className="text-teal-600">*</span>
              </label>
              <input
                type="date"
                value={newRescheduleDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setNewRescheduleDate(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-teal-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                New Time Slot <span className="text-teal-600">*</span>
              </label>
              <select
                value={newRescheduleSlot}
                onChange={(e) => setNewRescheduleSlot(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-teal-500"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Rescheduling Reason <span className="text-teal-600">*</span>
            </label>
            <select
              value={rescheduleReasonCategory}
              onChange={(e) => setRescheduleReasonCategory(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-teal-500"
            >
              {PREDEFINED_RESCHEDULE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Additional Reschedule Notes (Optional)
            </label>
            <textarea
              value={rescheduleNotes}
              onChange={(e) => setRescheduleNotes(e.target.value)}
              rows={2}
              placeholder="e.g., Adjusted slot to allow sufficient time for diagnostic imaging..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-xs outline-none focus:border-teal-500 resize-none text-ink-primary"
            />
          </div>

          {/* Mandatory Checkpoint Confirmation */}
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="rescheduleConfirmationCheckbox"
              checked={rescheduleConfirmed}
              onChange={(e) => setRescheduleConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-teal-600 border-surface-border focus:ring-teal-500 cursor-pointer"
            />
            <label htmlFor="rescheduleConfirmationCheckbox" className="text-xs text-teal-900 dark:text-teal-200 cursor-pointer leading-snug">
              <strong>Reschedule Checkpoint Confirmation:</strong> I have verified this slot has no conflicts, confirm the schedule shift for {rescheduleModalItem?.patientName}, and authorize appending this update to the appointment audit history.
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setRescheduleModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isProcessing}
              disabled={!rescheduleConfirmed || !newRescheduleDate}
              onClick={handleReschedule}
            >
              Confirm Reschedule & Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={!!completeModalItem}
        onClose={() => setCompleteModalItem(null)}
        title="Mark Appointment as Completed"
        description="Confirm that the clinical procedure or consultation has finished."
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-secondary">
            This will archive the appointment under the patient&apos;s completed dental history and trigger a post-visit notification.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setCompleteModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isProcessing}
              onClick={handleComplete}
            >
              Confirm Completed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
