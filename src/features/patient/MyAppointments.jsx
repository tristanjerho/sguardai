import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';
import { TIME_SLOTS } from '../../lib/constants';

export function MyAppointments() {
  const { user } = useAuth();
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  // Modal states
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [rescheduleModalItem, setRescheduleModalItem] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const loadAppointments = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const list = await appointmentService.listForPatient(user.id);
      setAppointments(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [user?.id]);

  const upcomingList = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'PENDING'
  );
  const pastList = appointments.filter((a) => a.status === 'COMPLETED');
  const cancelledList = appointments.filter(
    (a) => a.status === 'CANCELLED' || a.status === 'REJECTED'
  );

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', badge: upcomingList.length },
    { id: 'past', label: 'Past Visits', badge: pastList.length },
    { id: 'cancelled', label: 'Cancelled / Declined', badge: cancelledList.length },
  ];

  const handleConfirmCancel = async () => {
    if (!cancelModalItem) return;
    setIsCancelling(true);
    try {
      await appointmentService.cancel(
        cancelModalItem.id,
        cancelReason || 'Cancelled by patient request',
        user?.fullName || user?.email || user?.uid || 'Patient'
      );
      toast.success('Appointment cancelled.');
      setCancelModalItem(null);
      setCancelReason('');
      await loadAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel appointment.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleModalItem || !newDate || !newSlot) {
      setRescheduleError('Please choose both a new date and time slot.');
      return;
    }
    setIsRescheduling(true);
    setRescheduleError('');
    try {
      await appointmentService.reschedule(
        rescheduleModalItem.id,
        newDate,
        newSlot,
        rescheduleModalItem.dentistId,
        user?.fullName || user?.email || user?.uid || 'Patient'
      );
      toast.success('Appointment rescheduled and queued for confirmation!');
      setRescheduleModalItem(null);
      setNewDate('');
      setNewSlot('');
      await loadAppointments();
    } catch (err) {
      setRescheduleError(err.message || 'Failed to reschedule.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const currentDisplayedList =
    activeTab === 'upcoming'
      ? upcomingList
      : activeTab === 'past'
      ? pastList
      : cancelledList;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            My Appointments
          </h2>
          <p className="text-sm text-ink-secondary">
            Manage upcoming visits, review dental history, and reschedule slots.
          </p>
        </div>

        <Link to="/patient/book">
          <Button variant="primary" size="md" rightIcon={Plus}>
            Book New Visit
          </Button>
        </Link>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="rectangular" className="h-28" count={3} />
        </div>
      ) : currentDisplayedList.length === 0 ? (
        <EmptyState
          title={`No ${activeTab} appointments`}
          description={
            activeTab === 'upcoming'
              ? 'You do not have any pending or confirmed bookings at this time.'
              : `No ${activeTab} visits recorded.`
          }
          icon={CalendarCheck}
          actionLabel={activeTab === 'upcoming' ? 'Book an Appointment' : undefined}
          onAction={() => (window.location.href = '/patient/book')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {currentDisplayedList.map((apt) => (
            <Card key={apt.id} className="p-5 sm:p-6 transition-all hover:border-teal-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-ink-primary">
                      {apt.serviceName}
                    </h3>
                    <Badge status={apt.status} showDot>
                      {apt.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-ink-secondary">
                    <span className="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300">
                      <Calendar className="w-4 h-4" />
                      {formatDate(apt.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {apt.timeSlot}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {apt.dentistName}
                    </span>
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-ink-muted italic pt-1">
                      Note: &ldquo;{apt.notes}&rdquo;
                    </p>
                  )}

                  {apt.rejectionReason && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                      <strong>Decline Reason:</strong> {apt.rejectionReason}
                    </div>
                  )}

                  {apt.cancelReason && (
                    <p className="text-xs text-rose-500 font-medium">
                      Cancellation reason: {apt.cancelReason}
                    </p>
                  )}
                </div>

                {/* Actions for upcoming bookings */}
                {activeTab === 'upcoming' && (
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRescheduleModalItem(apt);
                        setNewDate(apt.date);
                        setNewSlot(apt.timeSlot);
                      }}
                      leftIcon={RefreshCw}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setCancelModalItem(apt)}
                      leftIcon={CalendarX}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelModalItem}
        onClose={() => setCancelModalItem(null)}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this scheduled visit?"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/50 space-y-1 text-xs text-ink-secondary">
            <p><strong>Service:</strong> {cancelModalItem?.serviceName}</p>
            <p><strong>Date & Time:</strong> {formatDate(cancelModalItem?.date)} at {cancelModalItem?.timeSlot}</p>
            <p><strong>Dentist:</strong> {cancelModalItem?.dentistName}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Reason for Cancellation (Optional)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Schedule conflict, feeling unwell..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => setCancelModalItem(null)}>
              Keep Booking
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isCancelling}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleModalItem}
        onClose={() => {
          setRescheduleModalItem(null);
          setRescheduleError('');
        }}
        title="Reschedule Appointment"
        description="Select a new date and time slot for your appointment."
      >
        <div className="space-y-4">
          {rescheduleError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">
              {rescheduleError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              New Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              New Time Slot
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setNewSlot(slot)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    newSlot === slot
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-surface-card border-surface-border hover:border-teal-400'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setRescheduleModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isRescheduling}
              onClick={handleConfirmReschedule}
            >
              Save New Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
