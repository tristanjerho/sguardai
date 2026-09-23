import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Stethoscope,
  Info,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { treatmentService } from '../../services/treatmentService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressRing } from '../../components/charts/ProgressRing';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

export function TreatmentProgress() {
  const { user } = useAuth();
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlan() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const data = await treatmentService.getByPatientId(user.id);
        setTreatment(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" className="h-44" />
        <Skeleton variant="rectangular" className="h-64" />
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Treatment Progress
          </h2>
          <p className="text-sm text-ink-secondary">
            Orthodontic tracking and alignment milestone timeline.
          </p>
        </div>
        <EmptyState
          title="No Active Treatment Plan Found"
          description="You do not currently have an active braces or orthodontic plan recorded. Book a consultation with an attending specialist to start your treatment plan."
          icon={Activity}
          actionLabel="Book Consultation"
          onAction={() => (window.location.href = '/patient/book')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Orthodontic Treatment Journey
          </h2>
          <p className="text-sm text-ink-secondary">
            {treatment.treatmentType}
          </p>
        </div>

        <Link to="/patient/book">
          <Button variant="primary" size="md" rightIcon={CalendarPlus}>
            Book Next Adjustment
          </Button>
        </Link>
      </div>

      {/* Progress Overview Hero Card */}
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-surface-card to-teal-50/40 dark:to-teal-950/20 shadow-soft-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex justify-center md:justify-start">
            <ProgressRing
              percentage={treatment.progressPercentage}
              size={150}
              strokeWidth={12}
              label={`Stage ${treatment.stageNumber} of ${treatment.totalStages}`}
              sublabel="Completed"
            />
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Active Phase
              </span>
              <h3 className="text-xl font-heading font-bold text-ink-primary">
                {treatment.stages?.[treatment.stageNumber - 1]?.name || treatment.stage}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink-secondary">
              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-100/50 space-y-0.5">
                <span className="text-ink-muted">Start Date:</span>
                <p className="font-semibold text-ink-primary">{formatDate(treatment.startDate)}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-100/50 space-y-0.5">
                <span className="text-ink-muted">Estimated Completion:</span>
                <p className="font-semibold text-ink-primary">{formatDate(treatment.estimatedCompletionDate)}</p>
              </div>

              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 space-y-0.5 sm:col-span-2">
                <span className="text-teal-800 dark:text-teal-300 font-bold">Next Target Adjustment:</span>
                <p className="font-bold text-teal-900 dark:text-teal-100 text-sm">
                  {formatDate(treatment.nextAdjustmentDate)} with {treatment.dentistName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Visual Timeline of Stages */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <CardTitle>Treatment Stage Roadmap</CardTitle>
          </div>
          <Badge variant="primary">
            Stage {treatment.stageNumber} / {treatment.totalStages}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-300">
            {treatment.stages?.map((stg) => {
              const isDone = stg.status === 'COMPLETED';
              const isCurrent = stg.status === 'IN_PROGRESS';

              return (
                <div key={stg.number} className="relative flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 flex-shrink-0 border-2 ${
                      isDone
                        ? 'bg-teal-600 border-teal-600 text-white shadow-soft'
                        : isCurrent
                        ? 'bg-surface-card border-teal-500 text-teal-600 ring-4 ring-teal-100 dark:ring-teal-950 shadow-glow'
                        : 'bg-surface-card border-surface-border text-ink-muted'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : stg.number}
                  </div>

                  <div className="flex-1 p-4 rounded-2xl border border-surface-border bg-surface-50/50 dark:bg-surface-100/30 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-heading font-bold text-sm text-ink-primary">
                        {stg.name}
                      </h4>
                      <span className="text-xs font-semibold text-ink-muted">
                        {stg.date}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary">
                      {isDone
                        ? 'Successfully finalized and verified during clinical visits.'
                        : isCurrent
                        ? 'Active phase: archwire adjustments and rotational alignment underway.'
                        : 'Scheduled upcoming treatment phase.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Attending Dentist Clinical Notes */}
      <Card className="border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <CardTitle>Dentist Clinical Instructions & Notes</CardTitle>
          </div>
          <span className="text-xs text-teal-800 dark:text-teal-300 font-bold">
            {treatment.dentistName}
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-ink-primary leading-relaxed bg-surface-card p-4 rounded-2xl border border-teal-200/60 dark:border-teal-800/40 italic">
            &ldquo;{treatment.dentistNotes}&rdquo;
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
