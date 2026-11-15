import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { treatmentService, generateDefaultStages } from '../../services/treatmentService';
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
      const userId = user?.id || user?.uid;
      if (!userId) return;
      try {
        setLoading(true);
        const data = await treatmentService.getByPatientId(userId);
        setTreatment(data);
      } catch (err) {
        console.error('Error loading patient treatment plan:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, [user?.id, user?.uid]);

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

  const stages = (treatment.stages && treatment.stages.length > 0)
    ? treatment.stages
    : generateDefaultStages(treatment.treatmentType, treatment.totalStages || 4, treatment.stageNumber || 1, treatment.startDate);

  const activeStage = stages[Math.max(0, (treatment.stageNumber || 1) - 1)];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl xs:text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight break-words">
            Orthodontic Treatment Journey
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5 break-words">
            {treatment.treatmentType}
          </p>
        </div>

        <Link to="/patient/book" className="w-full sm:w-auto shrink-0">
          <Button variant="primary" size="md" rightIcon={CalendarPlus} className="w-full sm:w-auto justify-center">
            Book Next Adjustment
          </Button>
        </Link>
      </div>

      {/* Progress Overview Hero Card */}
      <Card className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-surface-card to-teal-50/40 dark:from-[#0D1E4C] dark:to-[#26415E]/40 shadow-soft-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-center">
          <div className="md:col-span-4 lg:col-span-3 flex justify-center">
            <ProgressRing
              percentage={treatment.progressPercentage || 0}
              size={148}
              strokeWidth={12}
              label={`Stage ${treatment.stageNumber || 1} of ${treatment.totalStages || 4}`}
              sublabel="Completed"
            />
          </div>

          <div className="md:col-span-8 lg:col-span-9 min-w-0 space-y-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-[#C48CB3]">
                Active Phase
              </span>
              <h3 className="text-lg sm:text-xl font-heading font-bold text-ink-primary dark:text-[#F8FAFC] break-words">
                {activeStage?.name || treatment.stage || 'Active Progression'}
              </h3>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3 text-xs text-ink-secondary">
              <div className="p-3 sm:p-3.5 rounded-xl bg-surface-50 dark:bg-[#0B1B32]/75 border border-surface-border/40 dark:border-[#26415E]/80 space-y-0.5 min-w-0">
                <span className="block text-ink-muted dark:text-[#83A6CE]">Start Date:</span>
                <p className="font-semibold text-ink-primary dark:text-[#E5C9D7] break-words">
                  {formatDate(treatment.startDate)}
                </p>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-surface-50 dark:bg-[#0B1B32]/75 border border-surface-border/40 dark:border-[#26415E]/80 space-y-0.5 min-w-0">
                <span className="block text-ink-muted dark:text-[#83A6CE]">Estimated Completion:</span>
                <p className="font-semibold text-ink-primary dark:text-[#E5C9D7] break-words">
                  {formatDate(treatment.estimatedCompletionDate)}
                </p>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl bg-teal-50 dark:bg-[#0B1B32]/90 border border-teal-200 dark:border-[#83A6CE]/35 space-y-0.5 xs:col-span-2 min-w-0">
                <span className="block text-teal-800 dark:text-[#C48CB3] font-bold">
                  Next Target Adjustment:
                </span>
                <p className="font-bold text-teal-900 dark:text-[#E5C9D7] text-xs sm:text-sm break-words">
                  {formatDate(treatment.nextAdjustmentDate)} with {treatment.dentistName || 'Specialist'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Visual Timeline of Stages */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-teal-600 dark:text-[#C48CB3] shrink-0" />
            <CardTitle>Treatment Stage Roadmap</CardTitle>
          </div>
          <Badge variant="primary" className="shrink-0">
            Stage {treatment.stageNumber || 1} / {treatment.totalStages || 4}
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-5 sm:space-y-6">
            {stages.map((stg, idx) => {
              const isDone = stg.status === 'COMPLETED';
              const isCurrent = stg.status === 'IN_PROGRESS';
              const hasNext = idx < stages.length - 1;

              return (
                <div key={stg.number} className="relative flex items-start gap-3 sm:gap-4">
                  {/* Connector anchored strictly between consecutive step circle centers */}
                  {hasNext && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[15px] sm:left-[19px] top-8 sm:top-10 -bottom-5 sm:-bottom-6 w-0.5 bg-surface-200 dark:bg-[#26415E]"
                    />
                  )}

                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm z-10 flex-shrink-0 border-2 ${
                      isDone
                        ? 'bg-teal-600 border-teal-600 text-white shadow-soft dark:bg-[#83A6CE] dark:border-[#83A6CE] dark:text-[#0B1B32]'
                        : isCurrent
                        ? 'bg-surface-card border-teal-500 text-teal-600 dark:bg-[#0D1E4C] dark:border-[#C48CB3] dark:text-[#E5C9D7] ring-4 ring-teal-100 dark:ring-[#C48CB3]/20 shadow-glow'
                        : 'bg-surface-card border-surface-border dark:bg-[#0B1B32] dark:border-[#26415E] text-ink-muted dark:text-[#83A6CE]'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : stg.number}
                  </div>

                  <div className="flex-1 min-w-0 p-3.5 sm:p-4 rounded-2xl border border-surface-border dark:border-[#26415E]/80 bg-surface-50/50 dark:bg-[#0B1B32]/75 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2">
                      <h4 className="font-heading font-bold text-xs sm:text-sm text-ink-primary break-words">
                        {stg.name}
                      </h4>
                      <span className="text-[11px] sm:text-xs font-semibold text-ink-muted shrink-0">
                        {stg.date}
                      </span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed break-words">
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
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
            <CardTitle>Dentist Clinical Instructions & Notes</CardTitle>
          </div>
          <span className="text-xs text-teal-800 dark:text-teal-300 font-bold shrink-0">
            {treatment.dentistName}
          </span>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-ink-primary leading-relaxed bg-surface-card p-3.5 sm:p-4 rounded-2xl border border-teal-200/60 dark:border-teal-800/40 italic break-words">
            &ldquo;{treatment.dentistNotes}&rdquo;
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
