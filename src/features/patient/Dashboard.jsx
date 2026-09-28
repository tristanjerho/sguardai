import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Sparkles,
  Activity,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Bell,
  RefreshCw,
  FolderArchive,
  CalendarPlus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { appointmentService } from '../../services/appointmentService';
import { treatmentService } from '../../services/treatmentService';
import { patientService } from '../../services/patientService';
import { notificationService } from '../../services/notificationService';
import { Mascot } from '../../components/mascot/Mascot';
import { MascotBubble } from '../../components/mascot/MascotBubble';
import { getGreeting, MASCOT_MESSAGES } from '../../components/mascot/messages';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ProgressRing } from '../../components/charts/ProgressRing';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { formatDate, formatDateTime, formatRelativeTime } from '../../lib/formatters';

export function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [treatment, setTreatment] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const triviaList = MASCOT_MESSAGES.toothTrivia;

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    async function loadStaticData() {
      try {
        const trt = await treatmentService.getByPatientId(userId);
        setTreatment(trt || null);
      } catch (err) {
        console.error('Error loading patient dashboard details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStaticData();

    // Real-time listener for patient appointments
    const unsubAppts = appointmentService.subscribeToAppointments((appts) => {
      const patientAppts = appts.filter((a) => a.patientId === userId);
      const upcoming = patientAppts
        .filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING')
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      setNextAppointment(upcoming || null);
    });

    // Real-time listener for notifications
    const unsubNotifs = notificationService.subscribeForUser(userId, (notifs) => {
      setNotifications(notifs.slice(0, 3));
    });

    return () => {
      unsubAppts();
      unsubNotifs();
    };
  }, [user?.id, user?.uid]);

  const handleOpenNotification = async (notif) => {
    setSelectedNotif(notif);
    if (!notif.read) {
      try {
        await notificationService.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleNextTip = () => {
    setTriviaIndex((prev) => (prev + 1) % triviaList.length);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Sparky Greeting Hero */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-600 via-teal-500 to-teal-700 dark:from-[#0D1E4C] dark:via-[#1B2F52] dark:to-[#26415E] dark:border dark:border-[#83A6CE]/30 p-6 sm:p-8 text-white shadow-soft-lg dark:shadow-[0_12px_40px_-8px_rgba(11,27,50,0.8),0_0_30px_-5px_rgba(131,166,206,0.2)] flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-[#C48CB3]/25 dark:bg-[#C48CB3]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full bg-white/10 dark:bg-[#83A6CE]/20 blur-3xl pointer-events-none" />

        <div className="flex-shrink-0 flex items-center justify-center">
          <Mascot mood="happy" size="lg" />
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 dark:bg-[#83A6CE]/20 dark:border dark:border-[#83A6CE]/30 text-white dark:text-[#E5C9D7] text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#E5C9D7]" />
            <span>Oral Health Guardian</span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-heading font-extrabold tracking-tight text-white dark:text-[#F8FAFC]">
            {getGreeting(user?.fullName || user?.name || 'Friend')}
          </h2>

          <p className="text-sm text-teal-100 dark:text-[#E5C9D7]/90 max-w-xl">
            {treatment
              ? `You are currently at ${treatment.progressPercentage}% of your ${treatment.treatmentType}. Keep following your home-care plan!`
              : 'Keep up your daily oral routines and book your routine dental checkup regularly!'}
          </p>
        </div>

        <div className="z-10 flex-shrink-0">
          <Link to="/patient/book">
            <Button
              variant="accent"
              size="md"
              className="font-bold shadow-soft"
              rightIcon={ArrowRight}
            >
              Book Visit
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Appointment Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-[#83A6CE]" />
              <CardTitle>Next Scheduled Visit</CardTitle>
            </div>
            {nextAppointment && <Badge status={nextAppointment.status} showDot>{nextAppointment.status}</Badge>}
          </CardHeader>

          <CardContent>
            {nextAppointment ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-[#0B1B32]/75 border border-teal-200/70 dark:border-[#26415E]/80 dark:shadow-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-heading font-bold text-ink-primary">
                      {nextAppointment.serviceName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary dark:text-[#83A6CE]">
                      <span className="flex items-center gap-1 font-semibold text-teal-700 dark:text-[#E5C9D7]">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(nextAppointment.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {nextAppointment.timeSlot}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {nextAppointment.dentistName}
                      </span>
                    </div>
                  </div>

                  <Link to="/patient/appointments">
                    <Button variant="secondary" size="sm">
                      Manage Booking
                    </Button>
                  </Link>
                </div>

                {nextAppointment.notes && (
                  <p className="text-xs text-ink-muted italic">
                    Note: &ldquo;{nextAppointment.notes}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#26415E]/60 flex items-center justify-center text-ink-muted mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">No Upcoming Appointments</p>
                  <p className="text-xs text-ink-secondary dark:text-[#83A6CE] mt-0.5">
                    Schedule your next cleaning or orthodontic adjustment with our specialists.
                  </p>
                </div>
                <Link to="/patient/book">
                  <Button variant="primary" size="sm" rightIcon={ArrowRight}>
                    Book New Appointment
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Treatment Progress Ring Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600 dark:text-[#83A6CE]" />
              <CardTitle>Treatment Progress</CardTitle>
            </div>
            <Link
              to="/patient/treatment"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-[#83A6CE] hover:dark:text-[#E5C9D7]"
            >
              Details
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-4">
            {treatment ? (
              <div className="space-y-4 text-center">
                <ProgressRing
                  percentage={treatment.progressPercentage}
                  size={130}
                  label={`Stage ${treatment.stageNumber} of ${treatment.totalStages}`}
                  sublabel={treatment.stage.replace('_', ' ')}
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-ink-secondary dark:text-[#83A6CE]">
                    Next Adjustment Target:
                  </p>
                  <Badge variant="primary" size="sm">
                    {formatDate(treatment.nextAdjustmentDate)}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-ink-muted">No active orthodontic plan on file.</p>
                <Link to="/patient/book">
                  <Button variant="outline" size="sm">
                    Consult an Orthodontist
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Dental Records Quick Access & Daily Oral Care Trivia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dental Records Quick Access Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-teal-600 dark:text-[#83A6CE]" />
              <CardTitle>Dental Records & Imaging</CardTitle>
            </div>
            <Link
              to="/patient/records"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-[#83A6CE] hover:dark:text-[#E5C9D7]"
            >
              View Hub
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-50/60 dark:bg-[#0B1B32]/75 border border-teal-200/60 dark:border-[#26415E]/80 dark:shadow-inner">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 dark:bg-[#83A6CE]/20 dark:border dark:border-[#83A6CE]/30 flex items-center justify-center text-white dark:text-[#E5C9D7] shadow-soft">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-heading font-bold text-ink-primary text-base">
                    Clinical Chart & Radiographs
                  </p>
                  <p className="text-xs text-ink-secondary dark:text-[#83A6CE] mt-0.5">
                    End-to-end encrypted under <strong className="text-teal-700 dark:text-[#E5C9D7]">RA 10173</strong>
                  </p>
                </div>
              </div>

              <Link to="/patient/records">
                <Button variant="outline" size="sm" rightIcon={ArrowRight}>
                  Open Records
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Sparky Tooth Trivia & Care Tips Widget */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#C48CB3]" />
              <CardTitle>Sparky&apos;s Daily Care Tip</CardTitle>
            </div>
            <button
              onClick={handleNextTip}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100 dark:hover:bg-[#26415E]/60 flex items-center gap-1 text-xs font-semibold transition-colors"
              title="Next Trivia Fact"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Next Tip</span>
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-[#0B1B32]/75 border border-teal-200/60 dark:border-[#26415E]/80 dark:shadow-inner space-y-2">
              <p className="text-xs font-bold text-teal-800 dark:text-[#C48CB3] uppercase tracking-wider">
                Did You Know? (Fact #{triviaIndex + 1})
              </p>
              <p className="text-xs sm:text-sm text-ink-primary leading-relaxed dark:text-[#E5C9D7]">
                &ldquo;{triviaList[triviaIndex]}&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-ink-muted">Need to schedule a routine cleaning?</span>
              <Link to="/patient/book">
                <Button variant="primary" size="sm" rightIcon={CalendarPlus}>
                  Book Visit
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Notifications Widget */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-teal-600 dark:text-[#83A6CE]" />
              <CardTitle>Recent Alerts & Updates</CardTitle>
            </div>
            <Link
              to="/patient/notifications"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-[#83A6CE] hover:dark:text-[#E5C9D7]"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border/60 dark:divide-[#26415E]/80 p-0">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                className={`p-4 flex items-start justify-between gap-4 transition-all cursor-pointer hover:bg-surface-50 dark:hover:bg-[#26415E]/40 ${
                  !n.read ? 'bg-teal-50/40 dark:bg-[#83A6CE]/10' : ''
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[#C48CB3] flex-shrink-0" />}
                    <p className="text-sm font-semibold text-ink-primary hover:text-teal-600 dark:hover:text-[#E5C9D7] transition-colors">
                      {n.title}
                    </p>
                  </div>
                  <p className="text-xs text-ink-secondary dark:text-[#83A6CE] line-clamp-2">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-ink-muted whitespace-nowrap">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notification Details Pop-up Modal */}
      <Modal
        isOpen={!!selectedNotif}
        onClose={() => setSelectedNotif(null)}
        title="Notification Details"
        description="View full alert message and related shortcuts."
      >
        {selectedNotif && (
          <div className="space-y-5">
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/40">
              <div className="w-12 h-12 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center flex-shrink-0 shadow-soft">
                <Bell className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                    {selectedNotif.type || 'NOTIFICATION'}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatDateTime(selectedNotif.createdAt)}
                  </span>
                </div>
                <h4 className="font-heading font-bold text-base text-ink-primary">
                  {selectedNotif.title}
                </h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-50 dark:bg-slate-900/40 border border-surface-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Message
              </p>
              <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
                {selectedNotif.message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-border">
              <span className="text-xs text-ink-muted">
                Received: {formatRelativeTime(selectedNotif.createdAt)}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedNotif.type === 'APPOINTMENT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedNotif(null);
                      navigate('/patient/appointments');
                    }}
                    rightIcon={ArrowRight}
                  >
                    My Appointments
                  </Button>
                )}
                {selectedNotif.type === 'TREATMENT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedNotif(null);
                      navigate('/patient/treatment');
                    }}
                    rightIcon={ArrowRight}
                  >
                    View Treatment Plan
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedNotif(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
