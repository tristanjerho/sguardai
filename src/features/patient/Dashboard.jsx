import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Sparkles,
  Flame,
  Activity,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  Bell,
  RefreshCw,
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
import { ProgressRing } from '../../components/charts/ProgressRing';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { formatDate, formatRelativeTime } from '../../lib/formatters';

export function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [treatment, setTreatment] = useState(null);
  const [brushStreak, setBrushStreak] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const triviaList = MASCOT_MESSAGES.toothTrivia;

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const [appts, trt, streak, notifs] = await Promise.all([
          appointmentService.listForPatient(user.id),
          treatmentService.getByPatientId(user.id),
          patientService.getBrushStreak(user.id),
          notificationService.listForUser(user.id),
        ]);

        // Find upcoming appointment
        const upcoming = appts
          .filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING')
          .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

        setNextAppointment(upcoming || null);
        setTreatment(trt || null);
        setBrushStreak(streak || null);
        setNotifications(notifs.slice(0, 3));
      } catch (err) {
        console.error('Error loading patient dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

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

  const today = new Date().toISOString().split('T')[0];
  const isTodayBrushed = brushStreak?.history?.[today]?.morning || brushStreak?.history?.[today]?.night;

  return (
    <div className="space-y-6">
      {/* Top Sparky Greeting Hero */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-600 via-teal-500 to-teal-700 dark:from-teal-900 dark:via-teal-800 dark:to-slate-900 p-6 sm:p-8 text-white shadow-soft-lg flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

        <div className="flex-shrink-0 flex items-center justify-center">
          <Mascot mood={isTodayBrushed ? 'cheer' : 'happy'} size="lg" />
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Oral Health Guardian</span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-heading font-extrabold tracking-tight">
            {getGreeting(user?.fullName || user?.name || 'Friend')}
          </h2>

          <p className="text-sm text-teal-100 max-w-xl">
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
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Next Scheduled Visit</CardTitle>
            </div>
            {nextAppointment && <Badge status={nextAppointment.status} showDot>{nextAppointment.status}</Badge>}
          </CardHeader>

          <CardContent>
            {nextAppointment ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-heading font-bold text-ink-primary">
                      {nextAppointment.serviceName}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                      <span className="flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-300">
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
                <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center text-ink-muted mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">No Upcoming Appointments</p>
                  <p className="text-xs text-ink-secondary mt-0.5">
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
              <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Treatment Progress</CardTitle>
            </div>
            <Link
              to="/patient/treatment"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
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
                  <p className="text-xs font-semibold text-ink-secondary">
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

      {/* Second Row: Streak & Daily Oral Care Trivia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brush Streak Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <CardTitle>Brush Streak & Rewards</CardTitle>
            </div>
            <Link
              to="/patient/brush-streak"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              Check In
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500 flex flex-col items-center justify-center text-white shadow-soft">
                  <Flame className="w-6 h-6" />
                  <span className="text-xs font-extrabold leading-none">
                    {brushStreak?.currentStreak || 0}d
                  </span>
                </div>
                <div>
                  <p className="font-heading font-bold text-ink-primary text-base">
                    {brushStreak?.currentStreak || 0} Day Streak 🔥
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Total Points: <strong className="text-orange-600 dark:text-orange-400">{brushStreak?.totalPoints || 0} Smile Points</strong>
                  </p>
                </div>
              </div>

              <Link to="/patient/brush-streak">
                <Button variant="accent" size="sm">
                  Daily Check-in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Sparky Tooth Trivia & Quiz Widget */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <CardTitle>Sparky&apos;s Tooth Trivia</CardTitle>
            </div>
            <button
              onClick={handleNextTip}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-100 flex items-center gap-1 text-xs font-semibold"
              title="Next Trivia Fact"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Next Tip</span>
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 space-y-2">
              <p className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                Did You Know? (Fact #{triviaIndex + 1})
              </p>
              <p className="text-xs sm:text-sm text-ink-primary leading-relaxed">
                &ldquo;{triviaList[triviaIndex]}&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-ink-muted">Want to test your dental IQ?</span>
              <Link to="/patient/brush-streak">
                <Button variant="outline" size="sm">
                  Play Mini-Quiz
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
              <Bell className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Recent Alerts & Updates</CardTitle>
            </div>
            <Link
              to="/patient/notifications"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border/60 p-0">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  !n.read ? 'bg-teal-50/30 dark:bg-teal-950/20' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                    <p className="text-sm font-semibold text-ink-primary">{n.title}</p>
                  </div>
                  <p className="text-xs text-ink-secondary">{n.message}</p>
                </div>
                <span className="text-[11px] text-ink-muted whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(n.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
