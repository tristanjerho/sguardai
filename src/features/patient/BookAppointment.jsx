import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  X,
  ShieldCheck,
  Activity,
  Smile,
  Layers,
  Scissors,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { appointmentService } from '../../services/appointmentService';
import { authService } from '../../services/authService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Mascot } from '../../components/mascot/Mascot';
import { SERVICES, TIME_SLOTS } from '../../lib/constants';
import { formatDate } from '../../lib/formatters';

const SERVICE_CATEGORIES = [
  'All',
  'Cleaning',
  'Restorations',
  'Braces',
  'Dentures',
  'Oral Surgery',
];

const SERVICE_META = {
  'oral-prophylaxis': {
    category: 'Cleaning',
    subtitle: 'Cleaning',
    icon: Sparkles,
    prepTips: 'Brush your teeth before your visit. Avoid heavily staining food or coffee for 2 hours after cleaning.',
  },
  'dental-fillings': {
    category: 'Restorations',
    subtitle: 'Pasta',
    icon: Stethoscope,
    prepTips: 'Eat a light meal beforehand. Anesthesia may numb your cheek/lip for 1-2 hours.',
  },
  'crowns-bridges': {
    category: 'Restorations',
    subtitle: 'Crowns, Bridges',
    icon: ShieldCheck,
    prepTips: 'Please advise our specialist if you clench or grind your teeth. Digital impressions will be taken.',
  },
  'root-canal': {
    category: 'Restorations',
    subtitle: 'Endodontics',
    icon: Activity,
    prepTips: 'Take any prescribed analgesics or antibiotics as scheduled. Avoid hard chewing on the sore tooth.',
  },
  'partial-denture': {
    category: 'Dentures',
    subtitle: 'Removable Partial',
    icon: Layers,
    prepTips: 'Bring any current removable dentures or partials for clinical bite alignment.',
  },
  'complete-denture': {
    category: 'Dentures',
    subtitle: 'Full Arch Denture',
    icon: Layers,
    prepTips: 'Comprehensive anatomical tissue impression and vertical occlusion assessment.',
  },
  'flexible-denture': {
    category: 'Dentures',
    subtitle: 'Nylon Flexible',
    icon: Layers,
    prepTips: 'Lightweight biocompatible partial. Anatomical undercuts will be mapped for snug retention.',
  },
  'ortho-braces': {
    category: 'Braces',
    subtitle: 'Consultation / Adjustment',
    icon: Smile,
    prepTips: 'Brush and floss thoroughly prior to adjustment. Bring recent panoramic X-rays if available.',
  },
  'tooth-extraction': {
    category: 'Oral Surgery',
    subtitle: 'Simple / Surgical',
    icon: Scissors,
    prepTips: 'Eat a proper meal before appointment. Disclose any blood thinners or underlying medical history.',
  },
};

const COMPACT_STEPS = [
  { step: 1, label: 'Service', fullLabel: 'Service & Specialist' },
  { step: 2, label: 'Schedule', fullLabel: 'Date & Time' },
  { step: 3, label: 'Confirm', fullLabel: 'Review & Confirm' },
];

export function BookAppointment() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [dentists, setDentists] = useState([]);
  const [existingAppointments, setExistingAppointments] = useState([]);

  // Form selections
  const [selectedServiceId, setSelectedServiceId] = useState(SERVICES[0]?.id || 'oral-prophylaxis');
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Details sheet/modal state
  const [detailModalService, setDetailModalService] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [error, setError] = useState('');

  // Calculate min date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateString = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    // 1. Ensure baseline verified specialists exist if Firestore is pristine
    authService.ensureDefaultDentists();

    // 2. Realtime listener for active dentists
    const unsubDentists = authService.subscribeToDentists((dentistUsers) => {
      setDentists(dentistUsers);
      setSelectedDentistId((prev) => {
        if (prev && dentistUsers.some((d) => d.id === prev)) return prev;
        return dentistUsers.length > 0 ? dentistUsers[0].id : '';
      });
    });

    // 3. Realtime listener for appointments (conflict checking)
    const unsubAppts = appointmentService.subscribeToAppointments((allAppts) => {
      setExistingAppointments(allAppts);
    });

    return () => {
      unsubDentists();
      unsubAppts();
    };
  }, []);

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0];
  const selectedDentist = dentists.find((d) => d.id === selectedDentistId) || dentists[0];

  // Real-time filtered services list based on category & search query
  const filteredServices = useMemo(() => {
    return SERVICES.filter((s) => {
      const meta = SERVICE_META[s.id] || { category: 'Others', subtitle: '' };
      const matchesCategory =
        selectedCategory === 'All' || meta.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        meta.subtitle.toLowerCase().includes(query) ||
        meta.category.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // SUCCESS CONFIRMATION VIEW
  if (isSuccess && bookedAppointment) {
    return (
      <div className="max-w-xl mx-auto py-4 sm:py-8 px-2">
        <Card className="p-6 sm:p-8 text-center space-y-5 shadow-soft-lg">
          <div className="flex justify-center">
            <Mascot mood="cheer" size="md" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Appointment Request Received!</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ink-primary">
              Gardy is Cheering for You!
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary max-w-md mx-auto">
              Your appointment request is marked as <strong>PENDING</strong> and has been queued for review by {bookedAppointment.dentistName}.
            </p>
          </div>

          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-[#0B1B32] border border-teal-200 dark:border-[#26415E] text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-[#83A6CE]">
                Booking ID: {bookedAppointment.id}
              </span>
              <Badge status={bookedAppointment.status} showDot size="sm">
                {bookedAppointment.status}
              </Badge>
            </div>
            <p className="text-sm font-heading font-bold text-ink-primary">
              {bookedAppointment.serviceName}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-ink-secondary pt-2 border-t border-teal-200/50 dark:border-[#26415E]/60">
              <div>
                <span className="block text-ink-muted text-[11px]">Date:</span>
                <span className="font-semibold text-ink-primary">{formatDate(bookedAppointment.date)}</span>
              </div>
              <div>
                <span className="block text-ink-muted text-[11px]">Time Slot:</span>
                <span className="font-semibold text-ink-primary">{bookedAppointment.timeSlot}</span>
              </div>
              <div>
                <span className="block text-ink-muted text-[11px]">Dentist:</span>
                <span className="font-semibold text-ink-primary">{bookedAppointment.dentistName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <Link to="/patient/appointments" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full sm:w-auto font-bold">
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
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-36 sm:pb-24">
      {/* 3. Compact Header */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ink-primary tracking-tight">
          Book an Appointment
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary dark:text-[#83A6CE]">
          Choose your service and preferred dentist.
        </p>
      </div>

      {/* 4. Compact Stepper (Service -> Schedule -> Confirm) */}
      <div className="bg-surface-card dark:bg-[#0D1E4C] border border-surface-border dark:border-[#26415E]/80 rounded-2xl p-2.5 shadow-soft-xs">
        <div className="flex items-center justify-between px-1" role="tablist">
          {COMPACT_STEPS.map((s, idx) => {
            const isCompleted = s.step < currentStep;
            const isCurrent = s.step === currentStep;
            return (
              <React.Fragment key={s.step}>
                <button
                  type="button"
                  disabled={!isCompleted}
                  onClick={() => isCompleted && setCurrentStep(s.step)}
                  className={`flex items-center gap-1.5 sm:gap-2 text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'text-teal-600 dark:text-teal-400 font-bold'
                      : isCompleted
                      ? 'text-ink-primary hover:text-teal-600 cursor-pointer'
                      : 'text-ink-muted/70 opacity-60 cursor-not-allowed'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all shrink-0 ${
                      isCompleted
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 ring-2 ring-teal-500'
                        : 'bg-surface-100 dark:bg-[#1E3756] text-ink-muted'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3 stroke-[2.5]" /> : s.step}
                  </span>
                  <span className="hidden sm:inline text-xs">{s.fullLabel}</span>
                  <span className="sm:hidden text-xs">{s.label}</span>
                </button>

                {idx < COMPACT_STEPS.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-3 h-[2px] bg-surface-200 dark:bg-[#26415E] relative overflow-hidden rounded-full">
                    <div
                      className={`h-full bg-teal-500 transition-all duration-300 ${
                        isCompleted ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Service and Dentist Selection */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* 7. Search Input & Category Chips */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted dark:text-[#83A6CE] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dental services..."
                className="w-full bg-surface-card dark:bg-[#0D1E4C] border border-surface-border dark:border-[#26415E]/80 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-0.5 rounded-md"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Horizontal Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
              {SERVICE_CATEGORIES.map((cat) => {
                const isCatActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isCatActive
                        ? 'bg-teal-600 text-white shadow-soft-xs'
                        : 'bg-surface-card hover:bg-surface-100 dark:bg-[#0D1E4C] dark:hover:bg-[#1E3756] text-ink-secondary dark:text-[#83A6CE] border border-surface-border dark:border-[#26415E]/60'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Compact Selectable Service Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-secondary dark:text-[#83A6CE]">
                1. Select Dental Service
              </h3>
              <span className="text-[11px] text-ink-muted">
                {filteredServices.length} option{filteredServices.length === 1 ? '' : 's'}
              </span>
            </div>

            {filteredServices.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface-card dark:bg-[#0D1E4C] border border-surface-border dark:border-[#26415E] text-center space-y-2">
                <p className="text-xs font-semibold text-ink-muted">No dental services match your search.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="text-xs text-teal-600 font-bold hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredServices.map((srv) => {
                  const isSelected = selectedServiceId === srv.id;
                  const meta = SERVICE_META[srv.id] || {
                    category: 'Others',
                    subtitle: 'Dental Care',
                    icon: Stethoscope,
                  };
                  const ServiceIcon = meta.icon;

                  return (
                    <div
                      key={srv.id}
                      onClick={() => setSelectedServiceId(srv.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500/30 shadow-soft-sm'
                          : 'border-surface-border dark:border-[#26415E]/80 bg-surface-card hover:border-surface-300 dark:bg-[#0D1E4C] dark:hover:border-teal-500/40'
                      }`}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedServiceId(srv.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40'
                          }`}
                        >
                          <ServiceIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-heading font-bold text-xs sm:text-sm text-ink-primary truncate">
                            {srv.name}
                          </p>
                          <p className="text-[11px] text-ink-secondary dark:text-[#83A6CE] truncate">
                            {meta.subtitle} &middot; {srv.duration}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* 6. Expandable Details Action */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModalService(srv);
                          }}
                          className="text-[11px] font-semibold text-teal-600 dark:text-[#E5C9D7] hover:underline px-1.5 py-0.5 rounded-md hover:bg-teal-50 dark:hover:bg-[#26415E]/60 transition-colors"
                          title="View service details & preparation"
                          aria-label={`View details for ${srv.name}`}
                        >
                          Details
                        </button>

                        {/* Selection Indicator */}
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-surface-300 dark:border-[#26415E] bg-surface-50 dark:bg-[#0B1B32]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 9. Single Concise Pricing Notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/40 text-[11px] sm:text-xs text-teal-800 dark:text-teal-300">
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Final fees may vary after clinical evaluation based on severity and tooth damage.</span>
          </div>

          {/* 8. Compact Dentist Selection Rows */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-secondary dark:text-[#83A6CE]">
                2. Attending Dentist
              </h3>
              <span className="text-[11px] text-ink-muted">
                {dentists.length} specialist{dentists.length === 1 ? '' : 's'} available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dentists.length === 0 ? (
                <div className="col-span-full p-4 rounded-xl bg-surface-card dark:bg-[#0D1E4C] border border-surface-border text-center text-xs text-ink-muted">
                  No clinic dentists registered yet.
                </div>
              ) : (
                dentists.map((d) => {
                  const isSelected = selectedDentistId === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDentistId(d.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500/30 shadow-soft-sm'
                          : 'border-surface-border dark:border-[#26415E]/80 bg-surface-card hover:border-surface-300 dark:bg-[#0D1E4C] dark:hover:border-teal-500/40'
                      }`}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedDentistId(d.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-teal-100 dark:bg-teal-950/60 flex-shrink-0 border border-teal-200 dark:border-teal-800/40 flex items-center justify-center">
                          {d.avatar ? (
                            <img src={d.avatar} alt={d.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-xs sm:text-sm text-ink-primary truncate">
                            {d.fullName}
                          </p>
                          <p className="text-[11px] text-teal-700 dark:text-[#83A6CE] font-medium truncate">
                            {d.specialty || 'General Dentistry'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-surface-300 dark:border-[#26415E] bg-surface-50 dark:bg-[#0B1B32]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Desktop Continue button (in-flow) */}
          <div className="hidden lg:flex justify-end pt-2">
            <Button
              variant="primary"
              size="md"
              disabled={!selectedServiceId || !selectedDentistId}
              onClick={handleNext}
              rightIcon={ArrowRight}
              className="font-bold shadow-soft"
            >
              Choose Date &amp; Time
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Date & Slot Selection */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Card className="p-4 sm:p-6 space-y-4">
            <div>
              <Input
                label="Select Desired Date (Monday - Saturday)"
                type="date"
                min={minDateString}
                value={selectedDate}
                onChange={handleDateChange}
                leftIcon={Calendar}
                helperText="Clinic operates Mon-Sat. Only future dates are permitted."
                required
              />
            </div>

            {selectedDate && (
              <div className="space-y-2.5 pt-3 border-t border-surface-border dark:border-[#26415E]/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary dark:text-[#83A6CE]">
                    Available Slots ({selectedDentist?.fullName})
                  </label>
                  <span className="text-xs text-ink-muted">
                    {formatDate(selectedDate)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBooked = isSlotBooked(slot);
                    const isSelected = selectedSlot === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border ${
                          isBooked
                            ? 'bg-surface-100 text-ink-muted border-surface-200 line-through cursor-not-allowed opacity-50 dark:bg-[#122444] dark:border-[#26415E]'
                            : isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-soft ring-2 ring-teal-500/30'
                            : 'bg-surface-card dark:bg-[#0D1E4C] border-surface-border dark:border-[#26415E] hover:border-teal-400 text-ink-primary'
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

          <div className="hidden lg:flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(1)} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!selectedDate || !selectedSlot}
              onClick={handleNext}
              rightIcon={ArrowRight}
              className="font-bold"
            >
              Review Booking
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Confirmation */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Card className="p-4 sm:p-6 space-y-4">
            <h3 className="text-base font-heading font-bold text-ink-primary border-b border-surface-border dark:border-[#26415E]/80 pb-2.5">
              Appointment Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-[#0B1B32] border border-surface-border/50 dark:border-[#26415E]/60 space-y-0.5">
                <span className="text-[11px] text-ink-muted">Service Requested:</span>
                <p className="font-heading font-bold text-ink-primary text-xs sm:text-sm">
                  {selectedService?.name}
                </p>
                <span className="text-[11px] text-teal-700 dark:text-[#E5C9D7] block font-medium">
                  Estimated Duration: {selectedService?.duration}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 dark:bg-[#0B1B32] border border-surface-border/50 dark:border-[#26415E]/60 space-y-0.5">
                <span className="text-[11px] text-ink-muted">Attending Specialist:</span>
                <p className="font-heading font-bold text-ink-primary text-xs sm:text-sm">
                  {selectedDentist?.fullName}
                </p>
                <p className="text-[11px] text-ink-secondary dark:text-[#83A6CE]">{selectedDentist?.specialty}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 dark:bg-[#0B1B32] border border-surface-border/50 dark:border-[#26415E]/60 space-y-0.5">
                <span className="text-[11px] text-ink-muted">Date:</span>
                <p className="font-heading font-bold text-ink-primary text-xs sm:text-sm">
                  {formatDate(selectedDate)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 dark:bg-[#0B1B32] border border-surface-border/50 dark:border-[#26415E]/60 space-y-0.5">
                <span className="text-[11px] text-ink-muted">Time Slot:</span>
                <p className="font-heading font-bold text-ink-primary text-xs sm:text-sm">
                  {selectedSlot}
                </p>
              </div>
            </div>

            {/* Additional Patient Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-[#83A6CE]">
                Optional Notes for the Dentist
              </label>
              <textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={2}
                placeholder="e.g., Sensitivity to cold, wire loose, or previous filling chipped..."
                className="w-full bg-surface-base dark:bg-[#0B1B32] border border-surface-border dark:border-[#26415E] rounded-xl p-2.5 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/40 flex items-start gap-2 text-xs text-teal-800 dark:text-teal-300">
              <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span>
                Your request is submitted as <strong>PENDING</strong>. The clinic staff will confirm your slot within 24 hours.
              </span>
            </div>
          </Card>

          <div className="hidden lg:flex items-center justify-between pt-2">
            <Button variant="outline" size="md" onClick={() => setCurrentStep(2)} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={isLoading}
              onClick={handleConfirmBooking}
              rightIcon={CheckCircle2}
              className="font-bold"
            >
              Confirm &amp; Submit Booking
            </Button>
          </div>
        </div>
      )}

      {/* 10. Sticky Mobile Booking Action Bar (Docked above BottomTabBar) */}
      <div
        className="fixed left-0 right-0 z-20 bg-surface-card/95 dark:bg-[#0D1E4C]/95 backdrop-blur-md border-t border-surface-border dark:border-[#26415E]/80 px-4 py-2.5 shadow-soft-xl lg:hidden"
        style={{
          bottom: 'max(4.25rem, calc(4rem + env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-ink-muted dark:text-[#83A6CE]">
              {currentStep === 1 ? 'Selected Service' : currentStep === 2 ? 'Date & Slot' : 'Final Step'}
            </span>
            <p className="text-xs font-bold text-ink-primary dark:text-[#F8FAFC] truncate">
              {currentStep === 1
                ? selectedService?.name || 'Please select a service'
                : currentStep === 2
                ? selectedDate && selectedSlot
                  ? `${formatDate(selectedDate)} (${selectedSlot})`
                  : 'Select date & slot'
                : selectedService?.name}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="p-2 rounded-xl border border-surface-border dark:border-[#26415E] text-ink-secondary hover:text-ink-primary bg-surface-50 dark:bg-[#122444] text-xs font-semibold"
                aria-label="Previous step"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {currentStep === 1 && (
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedServiceId || !selectedDentistId}
                onClick={handleNext}
                rightIcon={ArrowRight}
                className="font-bold text-xs px-3.5 py-2 shadow-soft-sm"
              >
                Choose Schedule
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedDate || !selectedSlot}
                onClick={handleNext}
                rightIcon={ArrowRight}
                className="font-bold text-xs px-3.5 py-2 shadow-soft-sm"
              >
                Review Booking
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                variant="primary"
                size="sm"
                isLoading={isLoading}
                onClick={handleConfirmBooking}
                rightIcon={CheckCircle2}
                className="font-bold text-xs px-3.5 py-2 shadow-soft-sm"
              >
                Confirm &amp; Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 6. Expandable Service Details Sheet / Modal */}
      <Modal
        isOpen={Boolean(detailModalService)}
        onClose={() => setDetailModalService(null)}
        title={detailModalService?.name || 'Service Details'}
        size="sm"
      >
        {detailModalService && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-[#83A6CE]/20 dark:text-[#E5C9D7]">
                {SERVICE_META[detailModalService.id]?.category || 'Dental Service'}
              </span>
              <span className="text-xs text-ink-muted">
                Duration: {detailModalService.duration}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary dark:text-[#83A6CE]">
                Procedure Description
              </h4>
              <p className="text-xs sm:text-sm text-ink-primary dark:text-[#F8FAFC] leading-relaxed">
                {detailModalService.description}
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-xl bg-teal-50/70 dark:bg-[#122444] border border-teal-200/60 dark:border-[#26415E]">
              <h4 className="text-xs font-bold text-teal-800 dark:text-[#E5C9D7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-[#C48CB3]" />
                Patient Preparation Guide
              </h4>
              <p className="text-xs text-ink-secondary dark:text-[#83A6CE]">
                {SERVICE_META[detailModalService.id]?.prepTips ||
                  'Please arrive 10 minutes prior to your scheduled time with any previous dental records or imaging.'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-[#0B1B32] border border-surface-border dark:border-[#26415E]/60 text-[11px] text-ink-muted">
              <span className="font-semibold text-ink-secondary dark:text-[#83A6CE]">Pricing Policy: </span>
              {detailModalService.pricingNote ||
                'Final fees vary after clinical evaluation based on severity and tooth damage.'}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDetailModalService(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedServiceId(detailModalService.id);
                  setDetailModalService(null);
                  toast.success(`Selected ${detailModalService.name}`);
                }}
                rightIcon={Check}
              >
                Select This Service
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
