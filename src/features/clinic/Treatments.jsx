import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Calendar,
  User,
  Edit3,
  Save,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { treatmentService } from '../../services/treatmentService';
import { patientService } from '../../services/patientService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';
import { TREATMENT_STAGE } from '../../lib/constants';

const TREATMENT_PROCEDURES = [
  'Ortho Braces (Fixed Orthodontic Alignment)',
  'Clear Aligners (Invisalign Therapy)',
  'CROWNS, Bridges (Fixed Prosthodontics)',
  'Root Canal Treatment (Endodontic Care)',
  'Removable Partial denture',
  'Complete Denture',
  'FlexIBLE Denture',
  'Tooth Extraction & Socket Management',
  'Oral Prophylaxis & Periodontal Maintenance',
];

export function TreatmentsManager() {
  const { user } = useAuth();
  const toast = useToast();
  const [treatments, setTreatments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newTreatmentType, setNewTreatmentType] = useState(TREATMENT_PROCEDURES[0]);
  const [newDentistName, setNewDentistName] = useState(user?.fullName || 'Attending Dentist');
  const [newTotalStages, setNewTotalStages] = useState(4);
  const [newStage, setNewStage] = useState(TREATMENT_STAGE.INITIAL);
  const [newProgress, setNewProgress] = useState(10);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newNextAdjustmentDate, setNewNextAdjustmentDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [newEstimatedCompletionDate, setNewEstimatedCompletionDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newDentistNotes, setNewDentistNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editModalItem, setEditModalItem] = useState(null);
  const [stage, setStage] = useState('');
  const [stageNumber, setStageNumber] = useState(1);
  const [totalStages, setTotalStages] = useState(4);
  const [progressPercentage, setProgressPercentage] = useState(50);
  const [nextAdjustmentDate, setNextAdjustmentDate] = useState('');
  const [dentistNotes, setDentistNotes] = useState('');
  const [planStatus, setPlanStatus] = useState('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal
  const [deleteItem, setDeleteItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTreatments = async () => {
    try {
      setLoading(true);
      const [list, patList] = await Promise.all([
        treatmentService.list(),
        patientService.listPatients().catch(() => []),
      ]);
      setTreatments(list);
      setPatients(patList);
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

  const openCreateModal = () => {
    if (patients.length > 0 && !newPatientId) {
      setNewPatientId(patients[0].id);
    }
    setNewDentistName(user?.fullName || 'Attending Dentist');
    setIsCreateOpen(true);
  };

  const handleCreateTreatment = async (e) => {
    e.preventDefault();
    if (!newPatientId) {
      toast.error('Please select a patient.');
      return;
    }

    const selectedPatient = patients.find((p) => p.id === newPatientId);
    const patientName = selectedPatient ? selectedPatient.fullName : 'Patient';

    setIsCreating(true);
    try {
      await treatmentService.create({
        patientId: newPatientId,
        patientName,
        dentistId: user?.id || user?.uid || '',
        dentistName: newDentistName,
        treatmentType: newTreatmentType,
        stage: newStage,
        stageNumber: 1,
        totalStages: Number(newTotalStages),
        progressPercentage: Number(newProgress),
        startDate: newStartDate,
        nextAdjustmentDate: newNextAdjustmentDate,
        estimatedCompletionDate: newEstimatedCompletionDate,
        dentistNotes: newDentistNotes || `Initialized ${newTreatmentType} for ${patientName}.`,
        status: 'ACTIVE',
      });

      toast.success(`Created active treatment plan for ${patientName}!`);
      setIsCreateOpen(false);
      setNewDentistNotes('');
      await loadTreatments();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create treatment plan.');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (t) => {
    setEditModalItem(t);
    setStage(t.stage || TREATMENT_STAGE.INITIAL);
    setStageNumber(t.stageNumber || 1);
    setTotalStages(t.totalStages || 4);
    setProgressPercentage(t.progressPercentage || 0);
    setNextAdjustmentDate(t.nextAdjustmentDate || '');
    setDentistNotes(t.dentistNotes || '');
    setPlanStatus(t.status || 'ACTIVE');
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
          totalStages: Number(totalStages),
          progressPercentage: Number(progressPercentage),
          nextAdjustmentDate,
          dentistNotes,
          status: planStatus,
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

  const handleDeleteTreatment = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await treatmentService.delete(deleteItem.id, user?.fullName || 'Dentist');
      toast.success(`Deleted treatment plan for ${deleteItem.patientName}.`);
      setDeleteItem(null);
      await loadTreatments();
    } catch (err) {
      toast.error(err.message || 'Failed to delete treatment plan.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered treatment list
  const filteredTreatments = treatments.filter((t) => {
    const matchesSearch =
      (t.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.treatmentType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.dentistName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === 'ALL' || t.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

  const activeCount = treatments.filter((t) => t.status === 'ACTIVE').length;
  const completedCount = treatments.filter((t) => t.status === 'COMPLETED' || t.stage === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Treatment Plans & Cases
          </h2>
          <p className="text-sm text-ink-secondary">
            Monitor clinical milestones, wire adjustments, and progress tracking for active cases.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={openCreateModal}
          leftIcon={Plus}
        >
          New Treatment Plan
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-teal-50/60 to-surface-card dark:from-[#0D1E4C] dark:to-[#0B1B32] border-teal-100 dark:border-[#26415E]">
          <div className="w-12 h-12 rounded-2xl bg-teal-600/10 dark:bg-teal-400/20 text-teal-600 dark:text-teal-300 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-ink-secondary tracking-wider">Active Cases</p>
            <p className="text-2xl font-extrabold font-heading text-ink-primary">{activeCount}</p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-surface-card to-surface-50 dark:from-[#0D1E4C] dark:to-[#0B1B32] border-surface-border dark:border-[#26415E]">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-ink-secondary tracking-wider">In Progress</p>
            <p className="text-2xl font-extrabold font-heading text-ink-primary">
              {treatments.filter((t) => t.stage === 'IN_PROGRESS' || t.stage === 'ALIGNMENT').length}
            </p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-surface-card to-surface-50 dark:from-[#0D1E4C] dark:to-[#0B1B32] border-surface-border dark:border-[#26415E]">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-ink-secondary tracking-wider">Completed / Retention</p>
            <p className="text-2xl font-extrabold font-heading text-ink-primary">{completedCount}</p>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search patient, procedure, or dentist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'INITIAL', 'ALIGNMENT', 'IN_PROGRESS', 'RETENTION', 'COMPLETED'].map((stg) => (
            <button
              key={stg}
              onClick={() => setStageFilter(stg)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                stageFilter === stg
                  ? 'bg-teal-600 text-white shadow-soft dark:bg-[#83A6CE] dark:text-[#0B1B32]'
                  : 'bg-surface-card text-ink-secondary border border-surface-border hover:bg-surface-50'
              }`}
            >
              {stg.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton variant="rectangular" className="h-36" count={3} />
        </div>
      ) : filteredTreatments.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={treatments.length === 0 ? 'No Treatment Plans Recorded' : 'No Matching Plans Found'}
            description={
              treatments.length === 0
                ? 'Create a treatment plan to track clinical progression, archwire adjustments, and milestone stages for your patients.'
                : 'Try adjusting your search keywords or stage filter to find existing cases.'
            }
            icon={ClipboardList}
            actionLabel={treatments.length === 0 ? 'Create Treatment Plan' : 'Clear Filters'}
            onAction={treatments.length === 0 ? openCreateModal : () => { setSearchTerm(''); setStageFilter('ALL'); }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTreatments.map((t) => (
            <Card key={t.id} className="p-5 sm:p-6 transition-all hover:border-teal-300 dark:hover:border-teal-700">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-ink-primary">
                      {t.patientName}
                    </h3>
                    <Badge variant={t.status === 'COMPLETED' ? 'success' : 'primary'}>
                      Stage {t.stageNumber || 1} of {t.totalStages || 4} ({t.stage})
                    </Badge>
                    {t.status === 'COMPLETED' && (
                      <Badge variant="success">FINALIZED</Badge>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                    {t.treatmentType}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
                    <span className="flex items-center gap-1 font-semibold text-ink-primary">
                      <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      Next Adj: {formatDate(t.nextAdjustmentDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-ink-muted" />
                      Doctor: {t.dentistName}
                    </span>
                    {t.startDate && (
                      <span className="text-ink-muted">
                        Started: {formatDate(t.startDate)}
                      </span>
                    )}
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
                      {t.progressPercentage || 0}%
                    </span>
                    <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, t.progressPercentage || 0))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {t.patientId && (
                      <Link to={`/clinic/patients/${t.patientId}`}>
                        <Button variant="ghost" size="sm" title="View Patient Profile">
                          <ExternalLink className="w-4 h-4 text-ink-secondary" />
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(t)}
                      leftIcon={Edit3}
                    >
                      Update Stage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteItem(t)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE TREATMENT MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initialize New Treatment Plan"
        description="Set up patient milestones, procedure type, adjustment targets, and directions."
      >
        <form onSubmit={handleCreateTreatment} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Select Patient *
            </label>
            {patients.length > 0 ? (
              <select
                value={newPatientId}
                onChange={(e) => setNewPatientId(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName || p.name} ({p.email})
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Enter Patient ID"
                value={newPatientId}
                onChange={(e) => setNewPatientId(e.target.value)}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Treatment Procedure *
              </label>
              <select
                value={newTreatmentType}
                onChange={(e) => setNewTreatmentType(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500"
                required
              >
                {TREATMENT_PROCEDURES.map((proc) => (
                  <option key={proc} value={proc}>
                    {proc}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Attending Doctor / Specialist"
              value={newDentistName}
              onChange={(e) => setNewDentistName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Initial Phase"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              options={[
                { value: TREATMENT_STAGE.INITIAL, label: 'INITIAL (Bonding / Diagnostic)' },
                { value: TREATMENT_STAGE.ALIGNMENT, label: 'ALIGNMENT (Active Progression)' },
                { value: TREATMENT_STAGE.IN_PROGRESS, label: 'IN PROGRESS (Intervention)' },
                { value: TREATMENT_STAGE.RETENTION, label: 'RETENTION (Stabilization)' },
                { value: TREATMENT_STAGE.COMPLETED, label: 'COMPLETED (Finalized)' },
              ]}
              required
            />

            <Input
              label="Total Milestone Stages"
              type="number"
              min="2"
              max="10"
              value={newTotalStages}
              onChange={(e) => setNewTotalStages(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Initial Progress ({newProgress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={newProgress}
                onChange={(e) => setNewProgress(e.target.value)}
                className="w-full accent-teal-600 cursor-pointer mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              required
            />

            <Input
              label="Next Target Adjustment"
              type="date"
              value={newNextAdjustmentDate}
              onChange={(e) => setNewNextAdjustmentDate(e.target.value)}
              required
            />

            <Input
              label="Est. Completion"
              type="date"
              value={newEstimatedCompletionDate}
              onChange={(e) => setNewEstimatedCompletionDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Clinical Instructions & Patient Directions
            </label>
            <textarea
              value={newDentistNotes}
              onChange={(e) => setNewDentistNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Initial alignment archwire engaged. Instructed patient on interdental cleaning and elastic wear schedule..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isCreating}
              rightIcon={Save}
            >
              Create Treatment Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT TREATMENT MODAL */}
      <Modal
        isOpen={!!editModalItem}
        onClose={() => setEditModalItem(null)}
        title={`Update Treatment: ${editModalItem?.patientName}`}
        description="Update current phase, completion percentage, and clinical directions."
      >
        <form onSubmit={handleSaveTreatment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Treatment Stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              options={[
                { value: TREATMENT_STAGE.INITIAL, label: 'INITIAL (Bonding & Leveling)' },
                { value: TREATMENT_STAGE.ALIGNMENT, label: 'ALIGNMENT (Active Progression)' },
                { value: TREATMENT_STAGE.IN_PROGRESS, label: 'IN_PROGRESS (Space Closure / Detailing)' },
                { value: TREATMENT_STAGE.RETENTION, label: 'RETENTION (Debonding / Retainer)' },
                { value: TREATMENT_STAGE.COMPLETED, label: 'COMPLETED (Finalized)' },
              ]}
              required
            />

            <Input
              label={`Current Stage Number (1 to ${totalStages})`}
              type="number"
              min="1"
              max={totalStages}
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
                className="w-full accent-teal-600 cursor-pointer mt-2"
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
              Case Status
            </label>
            <select
              value={planStatus}
              onChange={(e) => setPlanStatus(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500"
            >
              <option value="ACTIVE">ACTIVE (Ongoing clinical care)</option>
              <option value="COMPLETED">COMPLETED (Treatment finalized & retainers delivered)</option>
              <option value="ON_HOLD">ON_HOLD (Temporarily paused)</option>
            </select>
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
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500 resize-none"
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

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete Treatment Plan"
        description={`Are you sure you want to delete the treatment plan for ${deleteItem?.patientName}? This action cannot be undone.`}
      >
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
          <Button variant="ghost" size="md" onClick={() => setDeleteItem(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isDeleting}
            onClick={handleDeleteTreatment}
            leftIcon={Trash2}
          >
            Confirm Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
