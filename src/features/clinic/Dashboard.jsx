import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Activity,
  FlaskConical,
  BrainCircuit,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  History,
  CheckCircle2,
} from 'lucide-react';
import { appointmentService } from '../../services/appointmentService';
import { treatmentService } from '../../services/treatmentService';
import { laboratoryService } from '../../services/laboratoryService';
import { patientService } from '../../services/patientService';
import { StatCard } from '../../components/charts/StatCard';
import { SimpleBarChart } from '../../components/charts/SimpleBarChart';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

function toLocalYMD(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseApptDate(appt) {
  if (!appt?.date) return null;
  if (typeof appt.date === 'string') {
    const match = appt.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const d = appt.date?.toDate
    ? appt.date.toDate()
    : appt.date?.seconds
      ? new Date(appt.date.seconds * 1000)
      : new Date(appt.date);
  return isNaN(d?.getTime()) ? null : d;
}

export function ClinicDashboard() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [, setPatients] = useState([]);

  // Time-range and history navigation states
  const [timeRangeMode, setTimeRangeMode] = useState('week'); // 'week' | '30days' | 'monthly'
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [selectedCalendarDateYmd, setSelectedCalendarDateYmd] = useState(() => toLocalYMD(new Date()));
  const [queueTab, setQueueTab] = useState('PENDING'); // 'PENDING' | 'CONFIRMED' | 'PAST' | 'ALL'

  useEffect(() => {
    async function loadClinicData() {
      try {
        setLoading(true);
        const [appts, trts, labs, pats] = await Promise.all([
          appointmentService.list(),
          treatmentService.list(),
          laboratoryService.list(),
          patientService.listPatients(),
        ]);
        setAppointments(appts || []);
        setTreatments(trts || []);
        setLabOrders(labs || []);
        setPatients(pats || []);
      } catch (err) {
        console.error('Error loading clinic dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadClinicData();
  }, []);

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;
  const activeTreatmentsCount = treatments.length;
  const labsDueSoon = labOrders.filter(
    (l) => l.status !== 'COMPLETED' && l.status !== 'DECLINED'
  );

  // Compute patient volume according to the chosen time range & week offset
  const {
    chartData,
    periodTitle,
    periodSubtitle,
    totalPeriodVisits,
    confirmedPeriodVisits,
    pendingPeriodVisits,
    weekRangeLabel,
    weekRelativeLabel,
  } = useMemo(() => {
    const today = new Date();

    if (timeRangeMode === 'week') {
      const currentDayOfWeek = today.getDay();
      const diffToMonday = (currentDayOfWeek === 0 ? -6 : 1) - currentDayOfWeek;
      const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);

      const selectedMonday = new Date(currentMonday);
      selectedMonday.setDate(currentMonday.getDate() + weekOffset * 7);
      selectedMonday.setHours(0, 0, 0, 0);

      const selectedSunday = new Date(selectedMonday);
      selectedSunday.setDate(selectedMonday.getDate() + 6);
      selectedSunday.setHours(23, 59, 59, 999);

      const daysList = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(selectedMonday);
        d.setDate(selectedMonday.getDate() + i);
        daysList.push(d);
      }

      const weekRangeLabel = `${selectedMonday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} – ${selectedSunday.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;

      const isCurrentWeek = weekOffset === 0;
      const isPastWeek = weekOffset < 0;
      const weekRelativeLabel = isCurrentWeek
        ? 'Current Week'
        : weekOffset === -1
          ? 'Last Week (Past)'
          : isPastWeek
            ? `${Math.abs(weekOffset)}w Ago (Past)`
            : `Upcoming (+${weekOffset}w)`;

      const weekData = daysList.map((dayDate) => {
        const ymd = toLocalYMD(dayDate);
        const dayShort = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = dayDate.getDate();

        const dayAppts = appointments.filter((appt) => {
          const d = parseApptDate(appt);
          return d && toLocalYMD(d) === ymd;
        });

        const confirmed = dayAppts.filter(
          (a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED'
        ).length;
        const pending = dayAppts.filter((a) => a.status === 'PENDING').length;

        const monthNum = dayDate.getMonth() + 1;
        const dayNumFormatted = String(dayNum).padStart(2, '0');
        const dateStr = `${monthNum}/${dayNumFormatted}`;

        return {
          day: dateStr,
          dateStr,
          dayShort,
          fullDate: dayDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          monthYear: dayDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          }),
          count: dayAppts.length,
          confirmed,
          pending,
          ymd,
          appts: dayAppts,
        };
      });

      const totalPeriodVisits = weekData.reduce((acc, d) => acc + d.count, 0);
      const confirmedPeriodVisits = weekData.reduce((acc, d) => acc + d.confirmed, 0);
      const pendingPeriodVisits = weekData.reduce((acc, d) => acc + d.pending, 0);

      return {
        chartData: weekData,
        periodTitle: isCurrentWeek
          ? 'Weekly Patient Volume'
          : `Patient Volume (${weekRelativeLabel})`,
        periodSubtitle: `${weekRangeLabel} • Mon – Sun`,
        totalPeriodVisits,
        confirmedPeriodVisits,
        pendingPeriodVisits,
        weekRangeLabel,
        weekRelativeLabel,
      };
    }

    if (timeRangeMode === '30days') {
      const past30DaysList = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        past30DaysList.push(d);
      }

      const past30Data = past30DaysList.map((d) => {
        const ymd = toLocalYMD(d);
        const dayAppts = appointments.filter((appt) => {
          const ad = parseApptDate(appt);
          return ad && toLocalYMD(ad) === ymd;
        });

        const confirmed = dayAppts.filter(
          (a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED'
        ).length;
        const pending = dayAppts.filter((a) => a.status === 'PENDING').length;
        const label = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

        return {
          day: label,
          fullDate: d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          count: dayAppts.length,
          confirmed,
          pending,
          ymd,
        };
      });

      const totalPeriodVisits = past30Data.reduce((acc, d) => acc + d.count, 0);
      const confirmedPeriodVisits = past30Data.reduce((acc, d) => acc + d.confirmed, 0);
      const pendingPeriodVisits = past30Data.reduce((acc, d) => acc + d.pending, 0);

      return {
        chartData: past30Data,
        periodTitle: 'Past 30 Days Patient Volume',
        periodSubtitle: `Daily activity (${past30DaysList[0].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} – ${past30DaysList[29].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })})`,
        totalPeriodVisits,
        confirmedPeriodVisits,
        pendingPeriodVisits,
        weekRangeLabel: 'Past 30 Days',
        weekRelativeLabel: 'Past 30 Days',
      };
    }

    // Monthly View (Past 6 Months)
    const monthsCount = 6;
    const monthsList = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthsList.push(d);
    }

    const monthlyData = monthsList.map((mDate) => {
      const y = mDate.getFullYear();
      const m = mDate.getMonth();
      const monthName = mDate.toLocaleDateString('en-US', { month: 'short' });
      const yearShort = String(y).slice(-2);

      const monthAppts = appointments.filter((appt) => {
        const ad = parseApptDate(appt);
        return ad && ad.getFullYear() === y && ad.getMonth() === m;
      });

      const confirmed = monthAppts.filter(
        (a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED'
      ).length;
      const pending = monthAppts.filter((a) => a.status === 'PENDING').length;

      return {
        day: `${monthName} '${yearShort}`,
        fullDate: mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        count: monthAppts.length,
        confirmed,
        pending,
      };
    });

    const totalPeriodVisits = monthlyData.reduce((acc, d) => acc + d.count, 0);
    const confirmedPeriodVisits = monthlyData.reduce((acc, d) => acc + d.confirmed, 0);
    const pendingPeriodVisits = monthlyData.reduce((acc, d) => acc + d.pending, 0);

    return {
      chartData: monthlyData,
      periodTitle: 'Past 6 Months Patient Volume',
      periodSubtitle: `Monthly trend (${monthsList[0].toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })} – ${monthsList[monthsCount - 1].toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })})`,
      totalPeriodVisits,
      confirmedPeriodVisits,
      pendingPeriodVisits,
      weekRangeLabel: 'Past 6 Months',
      weekRelativeLabel: 'Past 6 Months',
    };
  }, [appointments, timeRangeMode, weekOffset]);

  // Selected calendar day info for the interactive week strip
  const selectedDayInfo = useMemo(() => {
    if (timeRangeMode !== 'week' || !chartData || chartData.length === 0) return null;
    const found = chartData.find((d) => d.ymd === selectedCalendarDateYmd);
    return found || chartData[0];
  }, [timeRangeMode, chartData, selectedCalendarDateYmd]);

  // Filtered appointments list for the Queue card
  const displayedAppointments = useMemo(() => {
    const todayYmd = toLocalYMD(new Date());

    if (queueTab === 'PENDING') {
      return appointments.filter((a) => a.status === 'PENDING').slice(0, 5);
    }
    if (queueTab === 'CONFIRMED') {
      return appointments.filter((a) => a.status === 'CONFIRMED').slice(0, 5);
    }
    if (queueTab === 'PAST') {
      return appointments
        .filter((a) => {
          if (a.status === 'COMPLETED') return true;
          const ad = parseApptDate(a);
          return ad && toLocalYMD(ad) < todayYmd && a.status !== 'PENDING';
        })
        .slice(0, 5);
    }
    // ALL
    return appointments.slice(0, 5);
  }, [appointments, queueTab]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton variant="card" count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner for Clinic */}
      <div className="page-header-row">
        <div className="page-header-text">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Clinical Overview
          </h2>
          <p className="text-sm text-ink-secondary">
            Practice management, patient queue monitoring, and orthodontic tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
          <Link to="/clinic/ai-workstation">
            <Button variant="accent" size="sm" leftIcon={BrainCircuit}>
              Open AI Workstation
            </Button>
          </Link>
          <Link to="/clinic/queue">
            <Button variant="primary" size="sm" rightIcon={ArrowRight}>
              Manage Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approvals"
          value={pendingCount}
          subtitle="Requests awaiting review"
          icon={Clock}
          color="orange"
          trend={`${pendingCount} new`}
          trendDirection="up"
        />
        <StatCard
          title="Confirmed Visits"
          value={confirmedCount}
          subtitle="On-schedule bookings"
          icon={Calendar}
          color="teal"
        />
        <StatCard
          title="Active Ortho Plans"
          value={activeTreatmentsCount}
          subtitle="Under clinical monitoring"
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Lab Orders Due"
          value={labsDueSoon.length}
          subtitle="Appliance fabrications"
          icon={FlaskConical}
          color="purple"
        />
      </div>

      {/* Main Grid: Patient Volume Chart & Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Volume Recharts Bar Chart with Full Past & Range Navigation */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <CardTitle>{periodTitle}</CardTitle>
                {timeRangeMode === 'week' && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${weekOffset === 0
                        ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                      }`}
                  >
                    {weekRelativeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{periodSubtitle}</p>
            </div>

            {/* Time-Range Selector Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-surface-100 dark:bg-surface-200/50 p-1 rounded-xl border border-surface-border self-start sm:self-auto max-w-full">
              <button
                type="button"
                onClick={() => {
                  setTimeRangeMode('week');
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${timeRangeMode === 'week'
                    ? 'bg-surface-card text-teal-600 dark:text-teal-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Week View
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeRangeMode('30days');
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${timeRangeMode === '30days'
                    ? 'bg-surface-card text-teal-600 dark:text-teal-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Past 30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeRangeMode('monthly');
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${timeRangeMode === 'monthly'
                    ? 'bg-surface-card text-teal-600 dark:text-teal-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Past 6 Months
              </button>
            </div>
          </CardHeader>

          {/* Subheader Toolbar: Week Navigation Controls & Quick Stats */}
          <div className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-surface-border/50">
            {timeRangeMode === 'week' ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-surface-border hover:bg-surface-100 dark:hover:bg-surface-200 text-ink-primary transition-colors"
                  title="View Previous Week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev Week</span>
                </button>

                {weekOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 transition-colors"
                    title="Return to Current Week"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>This Week</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-surface-border hover:bg-surface-100 dark:hover:bg-surface-200 text-ink-primary transition-colors"
                  title="View Next Week"
                >
                  <span>Next Week</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Historical Volume Overview</span>
              </div>
            )}

            {/* Metric snapshot for the active view period */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="text-ink-secondary">
                Period Total:{' '}
                <strong className="text-ink-primary font-heading font-bold">
                  {totalPeriodVisits} {totalPeriodVisits === 1 ? 'visit' : 'visits'}
                </strong>
              </span>
              <span className="text-surface-border">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {confirmedPeriodVisits} Confirmed/Done
              </span>
              {pendingPeriodVisits > 0 && (
                <>
                  <span className="text-surface-border">•</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {pendingPeriodVisits} Pending
                  </span>
                </>
              )}
            </div>
          </div>

          <CardContent className="pt-4 space-y-4">
            {/* Interactive Week Calendar Date Strip (scrollable strip on < sm, 7-col grid on sm+) */}
            {timeRangeMode === 'week' && chartData && chartData.length > 0 && (
              <div className="flex sm:grid sm:grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
                {chartData.map((d) => {
                  const isSelected = selectedDayInfo?.ymd === d.ymd;
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      onClick={() => setSelectedCalendarDateYmd(d.ymd)}
                      className={`min-w-[68px] sm:min-w-0 shrink-0 flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/30 font-bold'
                          : 'bg-surface-base border-surface-border hover:border-teal-400/50 text-ink-primary'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-ink-muted">{d.dayShort}</span>
                      <span className="text-sm font-extrabold my-0.5">{d.day}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          d.count > 0
                            ? 'bg-teal-600 text-white'
                            : 'bg-surface-subtle text-ink-muted'
                        }`}
                      >
                        {d.count} {d.count === 1 ? 'visit' : 'visits'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <SimpleBarChart data={chartData} />

            {/* Selected Date Details Panel */}
            {timeRangeMode === 'week' && selectedDayInfo && (
              <div className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="font-heading font-bold text-sm text-ink-primary">
                      {selectedDayInfo.fullDate}
                    </span>
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/50">
                      {selectedDayInfo.monthYear}
                    </span>
                  </div>
                  <div className="text-xs text-ink-secondary">
                    <span className="font-bold text-ink-primary">{selectedDayInfo.count}</span> Scheduled ({selectedDayInfo.confirmed} Confirmed, {selectedDayInfo.pending} Pending)
                  </div>
                </div>

                {!selectedDayInfo.appts || selectedDayInfo.appts.length === 0 ? (
                  <p className="text-xs text-ink-muted py-3 text-center italic">
                    No appointments scheduled for {selectedDayInfo.day} ({selectedDayInfo.fullDate}).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedDayInfo.appts.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 rounded-xl bg-surface-base border border-surface-border text-xs space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-ink-primary">{apt.patientName}</span>
                          <span className="text-[10px] font-semibold text-ink-secondary uppercase tracking-wider shrink-0">
                            {apt.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-semibold text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>{apt.timeSlot}</span>
                          <span>•</span>
                          <span className="text-ink-secondary truncate">{apt.procedureName || apt.serviceName || 'Consultation'}</span>
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          Attending: {apt.dentistName || 'Attending Dentist'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chairside Queue & Past Visits Quick Records */}
        <Card>
          <CardHeader className="pb-3 border-b border-surface-border/50">
            <div className="w-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500 shrink-0" />
                <CardTitle>Patient Visits</CardTitle>
              </div>
              <Link
                to="/clinic/queue"
                className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 shrink-0"
              >
                View Full Queue
              </Link>
            </div>

            {/* Quick Filter Tabs: Pending vs Confirmed vs Past */}
            <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-200/50 p-1 rounded-xl border border-surface-border mt-3">
              <button
                type="button"
                onClick={() => setQueueTab('PENDING')}
                className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-all ${queueTab === 'PENDING'
                    ? 'bg-surface-card text-orange-600 dark:text-orange-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('CONFIRMED')}
                className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-all ${queueTab === 'CONFIRMED'
                    ? 'bg-surface-card text-teal-600 dark:text-teal-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Confirmed ({confirmedCount})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('PAST')}
                className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-all ${queueTab === 'PAST'
                    ? 'bg-surface-card text-purple-600 dark:text-purple-400 shadow-soft-sm font-bold'
                    : 'text-ink-muted hover:text-ink-primary'
                  }`}
              >
                Past ({completedCount})
              </button>
            </div>
          </CardHeader>

          <CardContent className="divide-y divide-surface-border/60 p-0">
            {displayedAppointments.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-ink-muted mx-auto opacity-40 mb-1" />
                <p className="text-xs font-semibold text-ink-secondary">
                  No {queueTab.toLowerCase()} appointment records.
                </p>
                <p className="text-[11px] text-ink-muted">
                  {queueTab === 'PAST'
                    ? 'Completed patient visits will be archived here.'
                    : 'All clear in this queue category.'}
                </p>
              </div>
            ) : (
              displayedAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 space-y-1.5 hover:bg-surface-50/50 dark:hover:bg-surface-200/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-heading font-bold text-sm text-ink-primary">
                      {apt.patientName}
                    </p>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary shrink-0">
                      {apt.timeSlot ? `${apt.timeSlot} • ${apt.status}` : apt.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    {apt.serviceName || apt.procedureName || 'Dental Consultation'}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    Date: {formatDate(apt.date)} • {apt.dentistName || 'Attending Dentist'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Orthodontic Treatments & Lab Orders Due Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Orthodontic Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Active Orthodontic Cases</CardTitle>
            </div>
            <Link
              to="/clinic/treatments"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              Manage Plans
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border/60 p-0">
            {treatments.length === 0 ? (
              <p className="p-6 text-xs text-center text-ink-muted">No active orthodontic plans.</p>
            ) : (
              treatments.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between gap-3 sm:gap-4 min-w-0">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm text-ink-primary truncate">
                      {t.patientName}
                    </p>
                    <p className="text-xs text-ink-secondary line-clamp-1">{t.treatmentType}</p>
                    <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                      <span>Next Adj: {formatDate(t.nextAdjustmentDate)}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-heading font-extrabold text-teal-600 dark:text-teal-400">
                      {t.progressPercentage}%
                    </span>
                    <div className="w-14 sm:w-16 h-2 rounded-full bg-surface-200 dark:bg-surface-300 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${t.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Lab Orders Tracking */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              <CardTitle>Dental Lab Orders</CardTitle>
            </div>
            <Link
              to="/clinic/lab-orders"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              View Orders
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border/60 p-0">
            {labOrders.length === 0 ? (
              <p className="p-6 text-xs text-center text-ink-muted">No lab orders in fabrication.</p>
            ) : (
              labOrders.slice(0, 4).map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between gap-3 sm:gap-4 min-w-0">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading font-bold text-sm text-ink-primary break-words">
                        {order.patientName}
                      </p>
                      <Badge status={order.status} size="sm" showDot>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-secondary break-words">{order.applianceType}</p>
                    <p className="text-[11px] text-ink-muted break-words">
                      Target Delivery: {formatDate(order.targetDeliveryDate)} • {order.vendor}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
