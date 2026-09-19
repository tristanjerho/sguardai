import React, { useState, useEffect } from 'react';
import {
  Activity,
  Calendar,
  User,
  Edit3,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { treatmentService } from '../../services/treatmentService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';
import { TREATMENT_STAGE } from '../../lib/constants';

export function TreatmentsManager() {
  const { user } = useAuth();
  const toast = useToast();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editModalItem, setEditModalItem] = useState(null);
  const [stage, setStage] = useState('');
  const [stageNumber, setStageNumber] = useState(1);
  const [progressPercentage, setProgressPercentage] = useState(50);
  const [nextAdjustmentDate, setNextAdjustmentDate] = useState('');
  const [dentistNotes, setDentistNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTreatments = async () => {
    try {
      setLoading(true);
      const list = await treatmentService.list();
      setTreatments(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load treatments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreatments();
  }, []);

  const openEditModal = (t) => {
    setEditModalItem(t);
    setStage(t.stage);
    setStageNumber(t.stageNumber || 1);
    setProgressPercentage(t.progressPercentage || 0);
    setNextAdjustmentDate(t.nextAdjustmentDate || '');
    setDentistNotes(t.dentistNotes || '');
  };

  const handleSaveTreatment = async (e) => {
    e.preventDefault();
    if (!editModalItem) return;

    setIsSaving(true);
    try {
      await treatmentService.update(
        editModalItem.id,
        {
          stage,
          stageNumber: Number(stageNumber),
          progressPercentage: Number(progressPercentage),
          nextAdjustmentDate,
          dentistNotes,
        },
        user?.fullName || 'Attending Dentist'
      );
      toast.success(`Updated orthodontic plan for ${editModalItem.patientName}.`);
      setEditModalItem(null);
      await loadTreatments();
    } catch (err) {
      toast.error(err.message || 'Failed to update treatment plan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Orthodontic Treatment Plans
        </h2>
        <p className="text-sm text-ink-secondary">
          Monitor wire adjustments, alignment staging, and progression targets for active cases.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="rectangular" className="h-36" count={3} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {treatments.map((t) => (
            <Card key={t.id} className="p-6 transition-all hover:border-teal-300">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-ink-primary">
                      {t.patientName}
                    </h3>
                    <Badge variant="primary">
                      Stage {t.stageNumber} of {t.totalStages} ({t.stage})
                    </Badge>
                  </div>

                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                    {t.treatmentType}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
                    <span className="flex items-center gap-1 font-semibold text-ink-primary">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      Next Adj: {formatDate(t.nextAdjustmentDate)}
                    </span>
                    <span>Doctor: {t.dentistName}</span>
                  </div>

                  {t.dentistNotes && (
                    <p className="text-xs text-ink-secondary bg-surface-50 dark:bg-surface-100/40 p-3 rounded-xl border border-surface-border italic">
                      &ldquo;{t.dentistNotes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 w-full lg:w-auto">
                  <div className="text-right w-full sm:w-36">
                    <span className="text-lg font-heading font-extrabold text-teal-600 dark:text-teal-400">
                      {t.progressPercentage}%
                    </span>
                    <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${t.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(t)}
                    leftIcon={Edit3}
                  >
                    Update Stage
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Treatment Modal */}
      <Modal
        isOpen={!!editModalItem}
        onClose={() => setEditModalItem(null)}
        title={`Update Treatment: ${editModalItem?.patientName}`}
        description="Update current alignment phase, completion percentage, and clinical directions."
      >
        <form onSubmit={handleSaveTreatment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Treatment Stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              options={[
                { value: TREATMENT_STAGE.INITIAL, label: 'INITIAL (Bonding & Leveling)' },
                { value: TREATMENT_STAGE.ALIGNMENT, label: 'ALIGNMENT (Active Archwires)' },
                { value: TREATMENT_STAGE.IN_PROGRESS, label: 'IN_PROGRESS (Space Closure)' },
                { value: TREATMENT_STAGE.RETENTION, label: 'RETENTION (Debonding / Retainer)' },
                { value: TREATMENT_STAGE.COMPLETED, label: 'COMPLETED (Finalized)' },
              ]}
              required
            />

            <Input
              label="Stage Number"
              type="number"
              min="1"
              max="10"
              value={stageNumber}
              onChange={(e) => setStageNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Progress Percentage ({progressPercentage}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={progressPercentage}
                onChange={(e) => setProgressPercentage(e.target.value)}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <Input
              label="Next Adjustment Target Date"
              type="date"
              value={nextAdjustmentDate}
              onChange={(e) => setNextAdjustmentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Dentist Clinical Notes & Patient Instructions
            </label>
            <textarea
              value={dentistNotes}
              onChange={(e) => setDentistNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Advised patient to wear class II intermaxillary elastics 24/7..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setEditModalItem(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              rightIcon={Save}
            >
              Save & Notify Patient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
