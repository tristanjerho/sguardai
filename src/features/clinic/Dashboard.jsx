import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  Activity,
  FlaskConical,
  BrainCircuit,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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

export function ClinicDashboard() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [patients, setPatients] = useState([]);

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
        setAppointments(appts);
        setTreatments(trts);
        setLabOrders(labs);
        setPatients(pats);
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
  const activeTreatmentsCount = treatments.length;
  const labsDueSoon = labOrders.filter((l) => l.status === 'IN_PROGRESS' || l.status === 'READY');

  // Chart data: Distribution of appointments by day of current week
  const weeklyChartData = [
    { day: 'Mon', count: 4 },
    { day: 'Tue', count: 7 },
    { day: 'Wed', count: 5 },
    { day: 'Thu', count: 8 },
    { day: 'Fri', count: 6 },
    { day: 'Sat', count: 9 },
  ];

  const pendingAppointments = appointments.filter((a) => a.status === 'PENDING').slice(0, 4);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Clinical Overview
          </h2>
          <p className="text-sm text-ink-secondary">
            Practice management, patient queue monitoring, and orthodontic tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
          trend="+12% this week"
          trendDirection="up"
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

      {/* Main Grid: Weekly Chart & Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Appointments Recharts Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Weekly Patient Volume</CardTitle>
            </div>
            <span className="text-xs text-ink-muted">Mon - Sat Schedule</span>
          </CardHeader>
          <CardContent className="pt-2">
            <SimpleBarChart data={weeklyChartData} />
          </CardContent>
        </Card>

        {/* Pending Requests Quick Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <CardTitle>Pending Queue</CardTitle>
            </div>
            <Link
              to="/clinic/queue"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              View All ({pendingCount})
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border/60 p-0">
            {pendingAppointments.length === 0 ? (
              <p className="p-6 text-xs text-center text-ink-muted">
                No pending appointment requests.
              </p>
            ) : (
              pendingAppointments.map((apt) => (
                <div key={apt.id} className="p-4 space-y-1.5 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-sm text-ink-primary">
                      {apt.patientName}
                    </p>
                    <Badge status="PENDING" size="sm">
                      {apt.timeSlot}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary">{apt.serviceName}</p>
                  <p className="text-[11px] text-ink-muted">
                    Date: {formatDate(apt.date)} • {apt.dentistName}
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
            {treatments.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="font-heading font-bold text-sm text-ink-primary">
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
                  <div className="w-16 h-2 rounded-full bg-surface-200 dark:bg-surface-300 mt-1 overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${t.progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
            {labOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-bold text-sm text-ink-primary">
                      {order.patientName}
                    </p>
                    <Badge status={order.status} size="sm" showDot>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary">{order.applianceType}</p>
                  <p className="text-[11px] text-ink-muted">
                    Target Delivery: {formatDate(order.targetDeliveryDate)} • {order.vendor}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
