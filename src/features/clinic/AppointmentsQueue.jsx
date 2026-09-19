import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

export function AppointmentsQueue() {
  const { user } = useAuth();
  const toast = useToast();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Action modals
  const [approveModalItem, setApproveModalItem] = useState(null);
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [completeModalItem, setCompleteModalItem] = useState(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const list = await appointmentService.list();
      setAppointments(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointments queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

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
      await loadAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to approve appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      toast.error('Please specify a clinical or scheduling reason for decline.');
      return;
    }
    setIsProcessing(true);
    try {
      await appointmentService.updateStatus(
        rejectModalItem.id,
        'REJECTED',
        rejectionReason,
        user.fullName || user.name || 'Dentist'
      );
      toast.success(`Declined appointment #${rejectModalItem.id}. Patient has been notified.`);
      setRejectModalItem(null);
      setRejectionReason('');
      await loadAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to reject appointment.');
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
      await loadAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to complete appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.dentistName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || apt.status === statusFilter;
    const matchesDate = !dateFilter || apt.date === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const statusTabs = [
    { id: 'ALL', label: 'All Requests', badge: appointments.length },
    {
      id: 'PENDING',
      label: 'Pending Approvals',
      badge: appointments.filter((a) => a.status === 'PENDING').length,
    },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'REJECTED', label: 'Declined' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Appointments & Patient Queue
        </h2>
        <p className="text-sm text-ink-secondary">
          Review patient booking requests, approve schedules, and track daily clinical arrivals.
        </p>
      </div>

      <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {/* Search and Date Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by patient name, service, or specialist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-base border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-surface-base border border-surface-border rounded-xl px-3 py-2 text-xs text-ink-primary outline-none focus:border-teal-500 w-full sm:w-auto"
            />
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
                Clear Date
              </Button>
            )}
          </div>
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
        <div className="grid grid-cols-1 gap-4">
          {filteredAppointments.map((apt) => (
            <Card key={apt.id} className="p-5 sm:p-6 transition-all hover:border-teal-300">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-ink-primary">
                      {apt.patientName}
                    </h3>
                    <Badge status={apt.status} showDot>
                      {apt.status}
                    </Badge>
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
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      Decline Reason: {apt.rejectionReason}
                    </p>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-surface-border">
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
                        variant="danger"
                        size="sm"
                        onClick={() => setRejectModalItem(apt)}
                        leftIcon={XCircle}
                      >
                        Decline
                      </Button>
                    </>
                  )}

                  {apt.status === 'CONFIRMED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCompleteModalItem(apt)}
                      leftIcon={CheckCircle2}
                    >
                      Mark Completed
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
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

      {/* Reject Modal with Mandatory Reason */}
      <Modal
        isOpen={!!rejectModalItem}
        onClose={() => {
          setRejectModalItem(null);
          setRejectionReason('');
        }}
        title="Decline Appointment Request"
        description="Please provide a clear clinical or scheduling reason for declining this request."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Decline Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="e.g., Dentist attending emergency surgical case. Please reschedule to Friday morning..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-rose-500 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setRejectModalItem(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isProcessing}
              disabled={!rejectionReason.trim()}
              onClick={handleReject}
            >
              Decline & Send Reason
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
