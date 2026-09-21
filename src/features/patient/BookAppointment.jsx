import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Stethoscope,
  Info,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { authService } from '../../services/authService';
import { Stepper } from '../../components/ui/Stepper';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Mascot } from '../../components/mascot/Mascot';
import { SERVICES, TIME_SLOTS } from '../../lib/constants';
import { formatDate } from '../../lib/formatters';

const WIZARD_STEPS = [
  { title: 'Service & Specialist', description: 'Choose procedure & doctor' },
  { title: 'Date & Time Slot', description: 'Pick schedule availability' },
  { title: 'Review & Confirm', description: 'Finalize request' },
];

export function BookAppointment() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [dentists, setDentists] = useState([]);
  const [existingAppointments, setExistingAppointments] = useState([]);

  // Form selections
  const [selectedServiceId, setSelectedServiceId] = useState('braces-adj');
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [error, setError] = useState('');

  // Calculate min date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateString = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    async function initData() {
      try {
        const [usersList, allAppts] = await Promise.all([
          authService.listUsers(),
          appointmentService.list(),
        ]);
        const dentistUsers = usersList.filter((u) => u.role === 'DENTIST');
        setDentists(dentistUsers);
        if (dentistUsers.length > 0) {
          setSelectedDentistId(dentistUsers[0].id);
        }
        setExistingAppointments(allAppts);
      } catch (err) {
        console.error(err);
      }
    }
    initData();
  }, []);

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0];
  const selectedDentist = dentists.find((d) => d.id === selectedDentistId) || dentists[0];

  // Helper to check if a specific time slot is booked on the selected date for this dentist
  const isSlotBooked = (slot) => {
    if (!selectedDate || !selectedDentistId) return false;
    return existingAppointments.some(
      (a) =>
        a.dentistId === selectedDentistId &&
        a.date === selectedDate &&
        a.timeSlot === slot &&
        a.status !== 'CANCELLED' &&
        a.status !== 'REJECTED'
    );
  };

  const handleDateChange = (e) => {
    const chosenDate = e.target.value;
    const dateObj = new Date(chosenDate + 'T00:00:00');
    // Reject Sundays (0 is Sunday)
    if (dateObj.getDay() === 0) {
      setError('The clinic is closed on Sundays. Please select Monday through Saturday.');
      setSelectedDate('');
      return;
    }
    setError('');
    setSelectedDate(chosenDate);
    setSelectedSlot(''); // Reset slot when date changes
  };

  const handleNext = () => {
    setError('');
    if (currentStep === 1) {
      if (!selectedServiceId || !selectedDentistId) {
        setError('Please select both a service and your preferred dentist.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedDate) {
        setError('Please select an appointment date.');
        return;
      }
      if (!selectedSlot) {
        setError('Please choose an available time slot.');
        return;
      }
      if (isSlotBooked(selectedSlot)) {
        setError('This slot is no longer available. Please select another time.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleConfirmBooking = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await appointmentService.create({
        patientId: user.id,
        patientName: user.fullName || user.email,
        dentistId: selectedDentist.id,
        dentistName: selectedDentist.fullName,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes: patientNotes,
      });

      setBookedAppointment(result);
      setIsSuccess(true);

      // Trigger celebration confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0d9488', '#14b8a6', '#f97316', '#fbbf24'],
      });

      toast.success('Your appointment was booked and sent for confirmation!');
    } catch (err) {
      setError(err.message || 'Failed to book appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess && bookedAppointment) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="p-8 text-center space-y-6 shadow-soft-lg">
          <div className="flex justify-center">
            <Mascot mood="cheer" size="lg" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Appointment Request Received!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary">
              Sparky is Cheering for You!
            </h2>
            <p className="text-sm text-ink-secondary max-w-md mx-auto">
              Your appointment request is marked as <strong>PENDING</strong> and has been queued for review by {bookedAppointment.dentistName}.
            </p>
          </div>

          {/* Booking Summary Box */}
          <div className="p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                Booking ID: {bookedAppointment.id}
              </span>
              <Badge status={bookedAppointment.status} showDot>
                {bookedAppointment.status}
              </Badge>
            </div>
            <p className="text-base font-heading font-bold text-ink-primary">
              {bookedAppointment.serviceName}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-ink-secondary pt-1 border-t border-teal-200/50 dark:border-teal-800/40">
              <div>
                <span className="block text-ink-muted">Date:</span>
                <span className="font-semibold text-ink-primary">{formatDate(bookedAppointment.date)}</span>
              </div>
              <div>
                <span className="block text-ink-muted">Time Slot:</span>
                <span className="font-semibold text-ink-primary">{bookedAppointment.timeSlot}</span>
              </div>
              <div>
                <span className="block text-ink-muted">Dentist:</span>
                <span className="font-semibold text-ink-primary">{bookedAppointment.dentistName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/patient/appointments" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full sm:w-auto">
                View in My Appointments
              </Button>
            </Link>
            <Link to="/patient" className="w-full sm:w-auto">
              <Button variant="secondary" size="md" className="w-full sm:w-auto">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Book Dental Appointment
        </h2>
        <p className="text-sm text-ink-secondary">
          Schedule your consultation, routine cleaning, or monthly braces adjustment.
        </p>
      </div>

      <Card className="p-4 sm:p-6 shadow-soft-sm">
        <Stepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={(s) => s < currentStep && setCurrentStep(s)}
        />
      </Card>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Service and Dentist Selection */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Services Selection Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-ink-secondary">
              1. Select Dental Service
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICES.map((srv) => {
                const isSelected = selectedServiceId === srv.id;
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/20 shadow-soft-sm'
                        : 'border-surface-border bg-surface-card hover:border-surface-300 dark:hover:border-surface-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-heading font-bold text-sm text-ink-primary">
                        {srv.name}
                      </p>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-md">
                        {srv.price}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary mt-1.5 line-clamp-2">
                      {srv.description}
                    </p>
                    <span className="block text-[11px] text-ink-muted mt-2">
                      Duration: {srv.duration}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dentist Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-ink-secondary">
              2. Select Attending Dentist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dentists.length === 0 ? (
                <div className="col-span-2 p-6 rounded-2xl bg-surface-subtle border border-surface-border text-center text-xs text-ink-muted">
                  No clinic dentists registered yet. A staff member must register a Dentist account before appointments can be assigned.
                </div>
              ) : (
                dentists.map((d) => {
                  const isSelected = selectedDentistId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDentistId(d.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/20 shadow-soft-sm'
                          : 'border-surface-border bg-surface-card hover:border-surface-300'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-teal-100 flex-shrink-0 border border-teal-200">
                        {d.avatar ? (
                          <img src={d.avatar} alt={d.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <Stethoscope className="w-6 h-6 text-teal-600 m-auto mt-3" />
                        )}
                      </div>
                      <div>
                        <p className="font-heading font-bold text-sm text-ink-primary">
                          {d.fullName}
                        </p>
                        <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">
                          {d.specialty || 'General Dentist'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="primary" size="lg" onClick={handleNext} rightIcon={ArrowRight}>
              Continue to Date & Slot
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Date & Slot Selection */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                Select Desired Date (Monday - Saturday)
              </label>
              <input
                type="date"
                min={minDateString}
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full bg-surface-base border border-surface-border rounded-xl p-3 text-sm text-ink-primary font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
              <p className="text-[11px] text-ink-muted">
                Note: The clinic is closed on Sundays. Only future dates are permitted.
              </p>
            </div>

            {selectedDate && (
              <div className="space-y-3 pt-3 border-t border-surface-border">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                    Available Time Slots for {selectedDentist?.fullName}
                  </label>
                  <span className="text-xs text-ink-muted">
                    {formatDate(selectedDate)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = isSlotBooked(slot);
                    const isSelected = selectedSlot === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                          isBooked
                            ? 'bg-surface-100 text-ink-muted border-surface-200 line-through cursor-not-allowed opacity-50'
                            : isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-soft ring-2 ring-teal-500/30'
                            : 'bg-surface-card border-surface-border hover:border-teal-400 text-ink-primary'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{slot}</span>
                        {isBooked && (
                          <span className="text-[9px] font-semibold text-rose-500 no-underline">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(1)} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!selectedDate || !selectedSlot}
              onClick={handleNext}
              rightIcon={ArrowRight}
            >
              Review Booking
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Confirmation */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-heading font-bold text-ink-primary border-b border-surface-border pb-3">
              Appointment Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 space-y-1">
                <span className="text-xs text-ink-muted">Service Requested:</span>
                <p className="font-heading font-bold text-ink-primary text-sm">
                  {selectedService?.name}
                </p>
                <p className="text-xs text-teal-700 dark:text-teal-300 font-semibold">
                  Estimated Fee: {selectedService?.price} ({selectedService?.duration})
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 space-y-1">
                <span className="text-xs text-ink-muted">Attending Specialist:</span>
                <p className="font-heading font-bold text-ink-primary text-sm">
                  {selectedDentist?.fullName}
                </p>
                <p className="text-xs text-ink-secondary">{selectedDentist?.specialty}</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 space-y-1">
                <span className="text-xs text-ink-muted">Date:</span>
                <p className="font-heading font-bold text-ink-primary text-sm">
                  {formatDate(selectedDate)}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 space-y-1">
                <span className="text-xs text-ink-muted">Time Slot:</span>
                <p className="font-heading font-bold text-ink-primary text-sm">
                  {selectedSlot}
                </p>
              </div>
            </div>

            {/* Additional Patient Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Optional Notes / Specific Complaints for the Dentist
              </label>
              <textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={3}
                placeholder="e.g., Upper right bracket loose, need wire change, or feeling sensitive to cold water..."
                className="w-full bg-surface-base border border-surface-border rounded-xl p-3 text-sm text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/40 flex items-start gap-2.5 text-xs text-teal-800 dark:text-teal-300">
              <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span>
                Your request will be placed in the <strong>PENDING</strong> queue. The clinic staff will confirm your slot within 24 hours.
              </span>
            </div>
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(2)} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              isLoading={isLoading}
              onClick={handleConfirmBooking}
              rightIcon={CheckCircle2}
            >
              Confirm & Submit Booking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
