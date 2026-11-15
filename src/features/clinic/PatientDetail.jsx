import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User,
  Phone,
  Calendar,
  HeartPulse,
  Clock,
  Activity,
  Image as ImageIcon,
  FileText,
  ArrowLeft,
  ShieldCheck,
  Plus,
  UploadCloud,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Contrast,
  ExternalLink,
  Move,
  CheckCircle2,
  Sparkles,
  Edit3,
  Save,
  PlusCircle,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Archive,
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { appointmentService } from '../../services/appointmentService';
import { treatmentService, generateDefaultStages } from '../../services/treatmentService';
import { odontogramService } from '../../services/odontogramService';
import { imageService } from '../../services/imageService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { OdontogramChart } from '../../components/odontogram/OdontogramChart';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate, formatPatientId } from '../../lib/formatters';
import { TREATMENT_STAGE } from '../../lib/constants';

export function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [treatment, setTreatment] = useState(null);
  const [records, setRecords] = useState([]);
  const [teeth, setTeeth] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Lightbox for X-ray & Zoom / Pan State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isInverted, setIsInverted] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const touchStartDistRef = React.useRef(0);

  const handleOpenRecord = (rec) => {
    setSelectedRecord(rec);
    setZoom(1);
    setRotation(0);
    setIsInverted(false);
    setIsHighContrast(false);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleCloseRecord = () => {
    setSelectedRecord(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
    setIsInverted(false);
    setIsHighContrast(false);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  // Desktop Mouse Drag handlers
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Mobile Touch Handlers (Single finger pan + Two finger pinch)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && zoom > 1) {
      setPan({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      });
    } else if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      if (factor > 1.05) {
        handleZoomIn();
        touchStartDistRef.current = dist;
      } else if (factor < 0.95) {
        handleZoomOut();
        touchStartDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDistRef.current = 0;
  };

  // Wheel zoom handler
  const handleWheel = (e) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('PANORAMIC');
  const [uploadToothNumbers, setUploadToothNumbers] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Treatment Plan Modal States
  const [isCreateTrtOpen, setIsCreateTrtOpen] = useState(false);
  const [isEditTrtOpen, setIsEditTrtOpen] = useState(false);
  const [trtType, setTrtType] = useState('Ortho Braces (Fixed Orthodontic Alignment)');
  const [trtDentist, setTrtDentist] = useState('');
  const [trtStagesCount, setTrtStagesCount] = useState(4);
  const [trtStage, setTrtStage] = useState(TREATMENT_STAGE.INITIAL);
  const [trtStageNumber, setTrtStageNumber] = useState(1);
  const [trtProgress, setTrtProgress] = useState(10);
  const [trtStartDate, setTrtStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [trtNextAdjDate, setTrtNextAdjDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [trtEstCompDate, setTrtEstCompDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [trtNotes, setTrtNotes] = useState('');
  const [trtStatus, setTrtStatus] = useState('ACTIVE');
  const [trtReopenReason, setTrtReopenReason] = useState('');
  const [trtCompletionConfirmed, setTrtCompletionConfirmed] = useState(false);
  const [showConfidentialDemographics, setShowConfidentialDemographics] = useState(false);
  const [isSavingTrt, setIsSavingTrt] = useState(false);

  // Workflow Checkpoint & Archiving States
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeMissingFields, setFinalizeMissingFields] = useState([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('Historical Dental File Archive');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isAssignDentistModalOpen, setIsAssignDentistModalOpen] = useState(false);
  const [targetDentistName, setTargetDentistName] = useState('Dr. Tristan Jerho Belingon');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleValidateAndFinalize = () => {
    const validation = patientService.validateRecordCompleteness(patient);
    setFinalizeMissingFields(validation.missingFields);
    setIsFinalizeModalOpen(true);
  };

  const handleConfirmFinalize = async () => {
    setIsActionLoading(true);
    try {
      const updated = await patientService.finalizePatientRecord(
        patient.id,
        user?.fullName || 'Attending Dentist',
        user?.id || 'dentist'
      );
      setPatient(updated);
      setIsFinalizeModalOpen(false);
      toast.success('Patient clinical chart has been finalized and locked for audit.');
    } catch (err) {
      toast.error(err.message || 'Failed to finalize patient chart.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleArchivePatient = async () => {
    setIsActionLoading(true);
    try {
      const updated = await patientService.archivePatient(
        patient.id,
        archiveReason,
        user?.fullName || 'Admin',
        user?.id || 'admin'
      );
      setPatient(updated);
      setIsArchiveModalOpen(false);
      toast.success('Patient case file moved to historical archive.');
    } catch (err) {
      toast.error(err.message || 'Failed to archive patient.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestorePatient = async () => {
    setIsActionLoading(true);
    try {
      const updated = await patientService.restorePatient(
        patient.id,
        user?.fullName || 'Admin',
        user?.id || 'admin'
      );
      setPatient(updated);
      setIsRestoreModalOpen(false);
      toast.success('Archived patient record restored to active clinic roster.');
    } catch (err) {
      toast.error(err.message || 'Failed to restore patient record.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAssignDentist = async () => {
    setIsActionLoading(true);
    try {
      const updated = await patientService.assignDentist(
        patient.id,
        `dentist_${targetDentistName.toLowerCase().replace(/[^a-z]/g, '_')}`,
        targetDentistName,
        user?.fullName || 'Staff',
        user?.id || 'staff'
      );
      setPatient(updated);
      setIsAssignDentistModalOpen(false);
      toast.success(`Patient assigned to ${targetDentistName}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to assign dentist.');
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const [pat, appts, trt, recs, odontogram] = await Promise.all([
          patientService.getById(id),
          appointmentService.listForPatient(id),
          treatmentService.getByPatientId(id),
          patientService.getRecords(id),
          odontogramService.getOdontogram(id),
        ]);
        setPatient(pat);
        setAppointments(appts);
        setTreatment(trt);
        setRecords(recs);
        setTeeth(odontogram);
      } catch (err) {
        console.error('Error loading patient details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleUpdateTooth = async (toothNumber, toothData) => {
    try {
      await odontogramService.updateTooth(id, toothNumber, toothData, user?.id);
      setTeeth((prev) => ({
        ...prev,
        [toothNumber]: { ...prev[toothNumber], ...toothData },
      }));
      toast.success(`Tooth #${toothNumber} chart updated in patient record.`);
    } catch (err) {
      toast.error(err.message || 'Failed to update tooth record in Firestore.');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select an image file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const toothArray = uploadToothNumbers
        ? uploadToothNumbers.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const newRecord = await imageService.uploadDentalImage(uploadFile, {
        patientId: id,
        type: uploadType,
        toothNumbers: toothArray,
        uploadedBy: user?.id || 'dentist',
        notes: uploadNotes,
      });

      setRecords((prev) => [newRecord, ...prev]);
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadToothNumbers('');
      setUploadNotes('');
      toast.success('Dental image uploaded to Cloudinary and linked to patient chart!');
    } catch (err) {
      toast.error(err.message || 'Cloudinary image upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const openCreateTrtModal = () => {
    setTrtDentist(user?.fullName || 'Attending Dentist');
    setTrtStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setTrtNextAdjDate(d.toISOString().split('T')[0]);
    const d2 = new Date();
    d2.setFullYear(d2.getFullYear() + 1);
    setTrtEstCompDate(d2.toISOString().split('T')[0]);
    setTrtNotes('');
    setTrtProgress(10);
    setTrtStagesCount(4);
    setIsCreateTrtOpen(true);
  };

  const openEditTrtModal = () => {
    if (!treatment) return;
    setTrtType(treatment.treatmentType || treatment.type || 'Treatment Plan');
    setTrtStage(treatment.stage || TREATMENT_STAGE.INITIAL);
    setTrtStageNumber(treatment.stageNumber || 1);
    setTrtStagesCount(treatment.totalStages || 4);
    setTrtProgress(treatment.progressPercentage || 0);
    setTrtNextAdjDate(treatment.nextAdjustmentDate || '');
    setTrtNotes(treatment.dentistNotes || '');
    setTrtStatus(treatment.status || 'ACTIVE');
    setIsEditTrtOpen(true);
  };

  const handleCreateTreatment = async (e) => {
    e.preventDefault();
    if (!id || !patient) return;
    setIsSavingTrt(true);
    try {
      const created = await treatmentService.create({
        patientId: id,
        patientName: patient.fullName || patient.name,
        dentistId: user?.id || user?.uid || '',
        dentistName: trtDentist || user?.fullName || 'Attending Dentist',
        treatmentType: trtType,
        stage: trtStage,
        stageNumber: 1,
        totalStages: Number(trtStagesCount),
        progressPercentage: Number(trtProgress),
        startDate: trtStartDate,
        nextAdjustmentDate: trtNextAdjDate,
        estimatedCompletionDate: trtEstCompDate,
        dentistNotes: trtNotes,
        status: 'ACTIVE',
      });
      setTreatment(created);
      toast.success(`Created active treatment plan for ${patient.fullName}!`);
      setIsCreateTrtOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to create treatment plan.');
    } finally {
      setIsSavingTrt(false);
    }
  };

  const handleUpdateTreatment = async (e) => {
    e.preventDefault();
    if (!treatment) return;

    const isCurrentlyCompleted = treatment.status === 'COMPLETED';
    const isTransitioningAway = trtStatus !== 'COMPLETED' && isCurrentlyCompleted;
    if (isTransitioningAway && !trtReopenReason.trim()) {
      toast.error('Please specify a clinical justification for reopening this finalized treatment.');
      return;
    }

    if (trtStatus === 'COMPLETED' && !isCurrentlyCompleted && !trtCompletionConfirmed) {
      toast.error('Please check the completion confirmation acknowledgment before saving.');
      return;
    }

    setIsSavingTrt(true);
    try {
      const updated = await treatmentService.update(
        treatment.id,
        {
          stage: trtStage,
          stageNumber: Number(trtStageNumber),
          totalStages: Number(trtStagesCount),
          progressPercentage: Number(trtProgress),
          nextAdjustmentDate: trtNextAdjDate,
          dentistNotes: trtNotes,
          status: trtStatus,
          reopenReason: trtReopenReason,
        },
        user?.fullName || 'Attending Dentist'
      );
      setTreatment(updated);
      toast.success('Treatment plan updated successfully!');
      setIsEditTrtOpen(false);
      setTrtReopenReason('');
      setTrtCompletionConfirmed(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update treatment plan.');
    } finally {
      setIsSavingTrt(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" className="h-32" />
        <Skeleton variant="rectangular" className="h-64" />
      </div>
    );
  }

  if (!patient) {
    return (
      <EmptyState
        title="Patient Record Not Found"
        description="The requested patient chart does not exist or has been removed."
        icon={User}
        actionLabel="Return to Patient Directory"
        onAction={() => (window.location.href = '/clinic/patients')}
      />
    );
  }

  const detailTabs = [
    { id: 'overview', label: 'Clinical Profile & Medical History' },
    { id: 'odontogram', label: '32-Tooth Odontogram' },
    { id: 'appointments', label: 'Appointments History', badge: appointments.length },
    { id: 'treatment', label: 'Treatment Plan' },
    { id: 'records', label: 'Radiology & X-Rays', badge: records.length },
  ];

  return (
    <div className="space-y-6">
      {/* Historical Archive Banner */}
      {patient.isArchived && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-bold uppercase tracking-wider text-[11px] text-amber-800 dark:text-amber-300">
                Archived Dental Case File
              </p>
              <p className="text-xs text-ink-secondary mt-0.5">
                Archived: {patient.archivedAt ? formatDate(patient.archivedAt) : 'Historical Archive'} • Reason: {patient.archivedReason || 'Inactive File Retention'}. This clinical file remains accessible for examination.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRestoreModalOpen(true)}
            className="text-amber-800 dark:text-amber-200 border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs shrink-0"
          >
            Restore Record to Active
          </Button>
        </div>
      )}

      {/* Header with back button & workflow checkpoint actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/clinic/patients">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to Directory
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Finalize Record Checkpoint Button */}
          {patient.recordStatus !== 'FINALIZED' ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={CheckCircle2}
              onClick={handleValidateAndFinalize}
              className="text-xs font-semibold"
            >
              Finalize Patient Chart
            </Button>
          ) : (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Chart Finalized &amp; Locked
            </span>
          )}

          {/* Archive / Restore Button */}
          {!patient.isArchived ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={Archive}
              onClick={() => setIsArchiveModalOpen(true)}
              className="text-xs text-ink-muted hover:text-ink-primary"
            >
              Archive Record
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={() => setIsRestoreModalOpen(true)}
              className="text-xs"
            >
              Restore File
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            leftIcon={UploadCloud}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload X-Ray / Dental Image
          </Button>
        </div>
      </div>

      {/* Patient Top Summary Card */}
      <Card className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-surface-card to-teal-50/40 dark:to-teal-950/20 shadow-soft-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <Avatar name={patient.fullName} size="xl" />
          <div className="flex-1 min-w-0 max-w-full space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ink-primary break-words">
                {patient.fullName}
              </h2>
              {patient.isArchived && (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-md">
                  Archived Case File
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted break-all">
              Patient ID: <span className="font-semibold text-ink-primary font-mono">{formatPatientId(patient)}</span> • {patient.email || 'No email registered'}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-ink-secondary flex-wrap">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Privacy Consent: {patient.privacyConsent ? 'Recorded (RA 10173)' : 'Pending Consent'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  Record Status:{' '}
                  <strong className={patient.recordStatus === 'FINALIZED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                    {patient.recordStatus === 'FINALIZED' ? 'Finalized' : 'Draft / Active'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  Attending Doctor:{' '}
                  <strong className="text-ink-primary">{patient.assignedDentistName || 'Unassigned'}</strong>
                </span>
                <button
                  onClick={() => {
                    setTargetDentistName(patient.assignedDentistName || 'Dr. Tristan Jerho Belingon');
                    setIsAssignDentistModalOpen(true);
                  }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline ml-1 font-semibold"
                >
                  (Change)
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={detailTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Medical & Dental History Card */}
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                Medical & Dental History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-xs sm:text-sm text-ink-secondary space-y-3">
              <div>
                <span className="font-bold text-ink-primary block mb-1 text-xs">Systemic Conditions & Allergies:</span>
                {patient.medicalHistory ? (
                  <p className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border text-xs leading-relaxed">
                    {patient.medicalHistory}
                  </p>
                ) : (
                  <p className="text-ink-muted italic text-xs">No systemic conditions or allergies recorded.</p>
                )}
              </div>

              {/* Patient-Reported Dental History: Root Canal Treatment */}
              <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                    Patient-Reported Dental History
                  </span>
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-md shrink-0">
                    Self-Reported
                  </span>
                </div>
                <div className="text-xs text-purple-950 dark:text-purple-100 space-y-0.5">
                  <p className="font-medium text-ink-primary">Last Root Canal Treatment:</p>
                  <p className="font-semibold text-purple-800 dark:text-purple-300">
                    {patient.lastRootCanal?.timeframe || 'Never undergone this procedure'}
                    {patient.lastRootCanal?.exactDate && ` (Reported Date: ${patient.lastRootCanal.exactDate})`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact Card */}
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-teal-500" />
                Emergency Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-xs sm:text-sm text-ink-secondary leading-relaxed">
              {patient.emergencyContact ? (
                <p className="p-4 rounded-xl bg-surface-subtle border border-surface-border">
                  {patient.emergencyContact}
                </p>
              ) : (
                <p className="text-ink-muted italic">No emergency contact registered yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Confidential Demographics & Administrative Contact (Role-Restricted) */}
          <Card className="p-4 sm:p-6 space-y-4 lg:col-span-2">
            <CardHeader className="p-0 border-0 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 w-full">
              <CardTitle className="text-base flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Confidential Patient Demographics & Contact</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowConfidentialDemographics(!showConfidentialDemographics)}
                className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {showConfidentialDemographics ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Confidential Demographics</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Authorized Contact & DOB</span>
                  </>
                )}
              </button>
            </CardHeader>
            <CardContent className="p-0 text-xs text-ink-secondary">
              {showConfidentialDemographics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-subtle border border-surface-border">
                  <div>
                    <span className="font-semibold text-ink-muted block text-[11px] uppercase tracking-wider mb-1">
                      Contact Phone:
                    </span>
                    <span className="font-bold text-ink-primary text-sm flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-teal-600" />
                      {patient.phone || 'No phone recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-ink-muted block text-[11px] uppercase tracking-wider mb-1">
                      Date of Birth:
                    </span>
                    <span className="font-bold text-ink-primary text-sm flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'N/A'}
                    </span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-surface-border text-[11px] text-ink-muted">
                    * In accordance with panelist privacy recommendations, contact phone and birthday are excluded from the general chart header and restricted to this authorized clinical section.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-surface-subtle/50 border border-dashed border-surface-border text-ink-muted text-xs flex items-center justify-between">
                  <span>Contact number and date of birth are protected to preserve patient privacy. Click &ldquo;View Authorized Contact & DOB&rdquo; to review.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: 32-Tooth Odontogram */}
      {activeTab === 'odontogram' && (
        <OdontogramChart
          teeth={teeth}
          onUpdateTooth={handleUpdateTooth}
          readOnly={false}
        />
      )}

      {/* TAB 3: Appointments */}
      {activeTab === 'appointments' && (
        <Card className="divide-y divide-surface-border overflow-hidden">
          {appointments.length === 0 ? (
            <p className="text-xs text-center text-ink-muted py-8">
              No appointments scheduled for this patient.
            </p>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-heading font-bold text-ink-primary">
                    {appt.procedureName}
                  </p>
                  <p className="text-xs text-ink-secondary flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{formatDate(appt.date)} at {appt.timeSlot}</span>
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                  {appt.status}
                </span>
              </div>
            ))
          )}
        </Card>
      )}

      {/* TAB 4: Treatment Plan */}
      {activeTab === 'treatment' && (
        <div className="space-y-6">
          {treatment ? (
            <Card className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-heading font-extrabold text-ink-primary break-words">
                      {treatment.treatmentType || treatment.type || 'Clinical Treatment Plan'}
                    </h3>
                    <Badge variant={treatment.status === 'COMPLETED' ? 'success' : 'primary'}>
                      Stage {treatment.stageNumber || 1} of {treatment.totalStages || 4} ({treatment.stage})
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Attending Doctor: <strong className="text-ink-primary">{treatment.dentistName || 'Staff Specialist'}</strong></span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openEditTrtModal}
                    leftIcon={Edit3}
                  >
                    Update Stage Progress
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openCreateTrtModal}
                    leftIcon={Plus}
                  >
                    New Plan
                  </Button>
                </div>
              </div>

              {/* Progress Metrics & Dates */}
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Progress</span>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-heading font-extrabold text-teal-600 dark:text-teal-400">
                      {treatment.progressPercentage || 0}%
                    </span>
                    <Activity className="w-5 h-5 text-teal-600/40" />
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, treatment.progressPercentage || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Start Date</span>
                  <p className="text-base font-bold text-ink-primary">{formatDate(treatment.startDate)}</p>
                  <p className="text-[11px] text-ink-muted">Case initiated</p>
                </div>

                <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/40 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Next Target Adjustment</span>
                  <p className="text-base font-bold text-teal-900 dark:text-teal-200">{formatDate(treatment.nextAdjustmentDate)}</p>
                  <p className="text-[11px] text-teal-700/80 dark:text-teal-400">Target appointment</p>
                </div>

                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Est. Completion</span>
                  <p className="text-base font-bold text-ink-primary">{formatDate(treatment.estimatedCompletionDate)}</p>
                  <p className="text-[11px] text-ink-muted">Target debonding/retention</p>
                </div>
              </div>

              {/* Doctor Clinical Directions */}
              {treatment.dentistNotes && (
                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Doctor Clinical Directions & Patient Guidance
                  </span>
                  <p className="text-sm text-ink-primary italic">
                    &ldquo;{treatment.dentistNotes}&rdquo;
                  </p>
                </div>
              )}

              {/* Clinical Milestone Roadmap */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-600" />
                  <h4 className="font-heading font-bold text-base text-ink-primary">
                    Clinical Milestone Roadmap ({treatment.stageNumber || 1} of {treatment.totalStages || 4})
                  </h4>
                </div>

                <div className="space-y-3">
                  {(treatment.stages && treatment.stages.length > 0
                    ? treatment.stages
                    : generateDefaultStages(treatment.treatmentType || treatment.type, treatment.totalStages || 4, treatment.stageNumber || 1, treatment.startDate)
                  ).map((stg, idx, arr) => {
                    const isDone = stg.status === 'COMPLETED';
                    const isCurrent = stg.status === 'IN_PROGRESS';
                    const hasNext = idx < arr.length - 1;

                    return (
                      <div key={stg.number} className="relative flex items-start gap-3 sm:gap-4">
                        {hasNext && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[15px] sm:left-[19px] top-8 sm:top-10 -bottom-3 w-0.5 bg-surface-200 dark:bg-surface-300"
                          />
                        )}
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs z-10 flex-shrink-0 border-2 ${isDone
                              ? 'bg-teal-600 border-teal-600 text-white shadow-soft'
                              : isCurrent
                                ? 'bg-surface-card border-teal-500 text-teal-600 ring-4 ring-teal-100 dark:ring-teal-900/40 shadow-glow'
                                : 'bg-surface-card border-surface-border text-ink-muted'
                            }`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : stg.number}
                        </div>

                        <div className="flex-1 min-w-0 p-3 sm:p-3.5 rounded-2xl border border-surface-border bg-surface-50/60 dark:bg-surface-100/30 space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h5 className="font-heading font-bold text-sm text-ink-primary break-words">
                              {stg.name}
                            </h5>
                            <Badge variant={isDone ? 'success' : isCurrent ? 'primary' : 'outline'}>
                              {isDone ? 'COMPLETED' : isCurrent ? 'CURRENT PHASE' : 'UPCOMING'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8">
              <EmptyState
                title="No Active Treatment Plan Recorded"
                description={`Start tracking orthodontic alignment, prosthetics staging, and clinical milestones for ${patient?.fullName || 'this patient'}.`}
                icon={Activity}
                actionLabel={`Create Treatment Plan for ${patient?.fullName || 'Patient'}`}
                onAction={openCreateTrtModal}
              />
            </Card>
          )}
        </div>
      )}

      {/* TAB 5: Radiology & X-Rays */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              leftIcon={UploadCloud}
              onClick={() => setIsUploadOpen(true)}
            >
              Upload Radiograph
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.length === 0 ? (
              <p className="text-xs text-ink-muted col-span-3 text-center py-10 bg-surface-card rounded-2xl border border-surface-border">
                No diagnostic imaging or X-rays available for this patient.
              </p>
            ) : (
              records.map((rec) => (
                <Card
                  key={rec.id}
                  hoverEffect
                  onClick={() => handleOpenRecord(rec)}
                  className="overflow-hidden cursor-pointer"
                >
                  <div className="h-44 bg-slate-900 overflow-hidden relative">
                    <img
                      src={rec.secureUrl || rec.imageUrl}
                      alt={rec.type}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="primary" size="sm">
                        {rec.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="font-heading font-bold text-sm text-ink-primary">
                      {rec.type} Scan {rec.toothNumbers?.length ? `(Tooth ${rec.toothNumbers.join(', ')})` : ''}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Uploaded {formatDate(rec.createdAt)}
                    </p>
                    {rec.notes && (
                      <p className="text-xs text-ink-secondary line-clamp-1 italic">
                        {rec.notes}
                      </p>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Interactive Medical Lightbox Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={handleCloseRecord}
        title={selectedRecord ? `${selectedRecord.type} Diagnostic Radiograph Viewer` : ''}
        maxWidth="max-w-5xl"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={ArrowLeft}
                  onClick={handleCloseRecord}
                  className="h-8 px-3 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 shadow-xs"
                >
                  Back
                </Button>

                <div className="h-4 w-px bg-surface-border hidden sm:block mx-1" />

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={ZoomIn}
                  onClick={handleZoomIn}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  Zoom In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={ZoomOut}
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  Zoom Out
                </Button>
                <span className="px-2 py-1 bg-surface-base border border-surface-border rounded-lg text-ink-primary font-mono text-xs font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={RotateCw}
                  onClick={handleRotate}
                  className="h-8 px-2.5 text-xs font-semibold inline-flex"
                  title="Rotate 90 degrees"
                >
                  Rotate
                </Button>
                <Button
                  variant={isHighContrast ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={Contrast}
                  onClick={() => setIsHighContrast(!isHighContrast)}
                  className="h-8 px-2.5 text-xs font-semibold"
                  title="Toggle High Contrast"
                >
                  Contrast
                </Button>
                <Button
                  variant={isInverted ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsInverted(!isInverted)}
                  className="h-8 px-2.5 text-xs font-semibold inline-flex"
                  title="Invert negative colors"
                >
                  Invert
                </Button>
                {(zoom > 1 || rotation !== 0 || isInverted || isHighContrast) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={RefreshCw}
                    onClick={handleResetView}
                    className="h-8 px-2 text-xs text-ink-secondary hover:text-ink-primary"
                  >
                    Reset
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedRecord.secureUrl || selectedRecord.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-base border border-surface-border text-ink-primary hover:text-teal-600 hover:border-teal-500 text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Resolution
                </a>
              </div>
            </div>

            {/* Viewport */}
            <div
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              style={{
                touchAction: zoom > 1 ? 'none' : 'pan-y',
              }}
              className={`relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 h-[42dvh] sm:h-[58dvh] flex items-center justify-center select-none ${zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                }`}
            >
              <div
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom}) rotate(${rotation}deg)`,
                  filter: `${isInverted ? 'invert(1) ' : ''}${isHighContrast ? 'contrast(1.6) brightness(1.1) ' : ''}`,
                  willChange: 'transform',
                  transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className="max-h-[40dvh] sm:max-h-[54dvh] max-w-full flex items-center justify-center origin-center pointer-events-none transform-gpu"
              >
                <img
                  src={selectedRecord.secureUrl || selectedRecord.imageUrl}
                  alt={selectedRecord.type}
                  draggable={false}
                  className="max-h-[38dvh] sm:max-h-[52dvh] w-auto object-contain rounded-xl shadow-2xl pointer-events-none select-none"
                />
              </div>

              {zoom > 1 && (
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-teal-300 text-[11px] px-3 py-1.5 rounded-xl border border-slate-700/60 flex items-center gap-1.5 pointer-events-none select-none">
                  <Move className="w-3.5 h-3.5 text-teal-400" />
                  Drag with finger or mouse to pan
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border text-xs text-ink-secondary space-y-1">
              <div className="font-semibold text-ink-primary">Clinical Notes & Observations:</div>
              <p className="whitespace-pre-wrap">{selectedRecord.notes || 'No notes attached.'}</p>
              {selectedRecord.toothNumbers?.length > 0 && (
                <div className="pt-1 text-teal-600 font-medium">
                  Associated Teeth: #{selectedRecord.toothNumbers.join(', #')}
                </div>
              )}
            </div>

            {/* Bottom Back Button */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={ArrowLeft}
                onClick={handleCloseRecord}
                className="w-full sm:w-auto font-bold"
              >
                Back to Patient Chart
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cloudinary Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Radiograph to Cloudinary"
        size="md"
      >
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Radiograph File
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/dicom,.dcm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) {
                  setUploadFile(null);
                  return;
                }
                if (f.size === 0) {
                  toast.error('Selected file is empty (0 bytes). Please select a valid dental image.');
                  e.target.value = '';
                  setUploadFile(null);
                  return;
                }
                if (f.size > 10 * 1024 * 1024) {
                  toast.error('File size exceeds the 10 MB maximum limit.');
                  e.target.value = '';
                  setUploadFile(null);
                  return;
                }
                const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/dicom', 'image/x-dicom'];
                if (!allowed.includes(f.type) && !/\.(jpe?g|png|webp|dcm|dicom)$/i.test(f.name)) {
                  toast.error('Unsupported file format. Please upload JPEG, PNG, WEBP, or DICOM files.');
                  e.target.value = '';
                  setUploadFile(null);
                  return;
                }
                setUploadFile(f);
              }}
              required
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
            />
            <p className="text-[11px] text-ink-muted">
              Supported formats: JPEG, PNG, WEBP, DICOM (.dcm). Maximum file size: 10 MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Radiograph Type
            </label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none"
            >
              <option value="PANORAMIC">Panoramic OPG Scan</option>
              <option value="PERIAPICAL">Periapical Radiograph</option>
              <option value="BITEWING">Bitewing Radiograph</option>
              <option value="INTRAORAL">Intraoral Photograph</option>
              <option value="EXTRAORAL">Extraoral Facial Photograph</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Associated Tooth Numbers (optional, comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. 16, 17, 38"
              value={uploadToothNumbers}
              onChange={(e) => setUploadToothNumbers(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Diagnostic Notes
            </label>
            <textarea
              placeholder="Enter radiographic observations or referral findings..."
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isUploading}
              leftIcon={UploadCloud}
            >
              Upload to Cloudinary
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE TREATMENT MODAL */}
      <Modal
        isOpen={isCreateTrtOpen}
        onClose={() => setIsCreateTrtOpen(false)}
        title={`Initialize Treatment: ${patient?.fullName}`}
        description="Set up clinical procedure, total milestone phases, and initial directions."
      >
        <form onSubmit={handleCreateTreatment} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Treatment Procedure *
            </label>
            <select
              value={trtType}
              onChange={(e) => setTrtType(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500"
              required
            >
              <option value="Ortho Braces (Fixed Orthodontic Alignment)">Ortho Braces (Fixed Orthodontic Alignment)</option>
              <option value="Clear Aligners (Invisalign Therapy)">Clear Aligners (Invisalign Therapy)</option>
              <option value="CROWNS, Bridges (Fixed Prosthodontics)">CROWNS, Bridges (Fixed Prosthodontics)</option>
              <option value="Root Canal Treatment (Endodontic Care)">Root Canal Treatment (Endodontic Care)</option>
              <option value="Removable Partial denture">Removable Partial denture</option>
              <option value="Complete Denture">Complete Denture</option>
              <option value="FlexIBLE Denture">FlexIBLE Denture</option>
              <option value="Tooth Extraction & Socket Management">Tooth Extraction & Socket Management</option>
              <option value="Oral Prophylaxis & Periodontal Maintenance">Oral Prophylaxis & Periodontal Maintenance</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Attending Doctor / Specialist"
              value={trtDentist}
              onChange={(e) => setTrtDentist(e.target.value)}
              required
            />

            <Select
              label="Initial Phase"
              value={trtStage}
              onChange={(e) => setTrtStage(e.target.value)}
              options={[
                { value: TREATMENT_STAGE.INITIAL, label: 'INITIAL (Bonding / Diagnostic)' },
                { value: TREATMENT_STAGE.ALIGNMENT, label: 'ALIGNMENT (Active Progression)' },
                { value: TREATMENT_STAGE.IN_PROGRESS, label: 'IN PROGRESS (Intervention)' },
                { value: TREATMENT_STAGE.RETENTION, label: 'RETENTION (Stabilization)' },
                { value: TREATMENT_STAGE.COMPLETED, label: 'COMPLETED (Finalized)' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Total Milestone Stages"
              type="number"
              min="2"
              max="10"
              value={trtStagesCount}
              onChange={(e) => setTrtStagesCount(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Initial Progress ({trtProgress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={trtProgress}
                onChange={(e) => setTrtProgress(e.target.value)}
                className="w-full accent-teal-600 cursor-pointer mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={trtStartDate}
              onChange={(e) => setTrtStartDate(e.target.value)}
              required
            />

            <Input
              label="Next Adjustment Target"
              type="date"
              value={trtNextAdjDate}
              onChange={(e) => setTrtNextAdjDate(e.target.value)}
              required
            />

            <Input
              label="Est. Completion"
              type="date"
              value={trtEstCompDate}
              onChange={(e) => setTrtEstCompDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Clinical Instructions & Patient Directions
            </label>
            <textarea
              value={trtNotes}
              onChange={(e) => setTrtNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Initial alignment archwire engaged. Instructed patient on hygiene and elastic wear..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setIsCreateTrtOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSavingTrt}
              rightIcon={Save}
            >
              Create Treatment Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT TREATMENT MODAL */}
      <Modal
        isOpen={isEditTrtOpen}
        onClose={() => setIsEditTrtOpen(false)}
        title={`Update Treatment: ${patient?.fullName}`}
        description="Advance milestone stage, update completion percentage, and record directions."
      >
        <form onSubmit={handleUpdateTreatment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Current Phase"
              value={trtStage}
              onChange={(e) => setTrtStage(e.target.value)}
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
              label={`Current Stage Number (1 to ${trtStagesCount})`}
              type="number"
              min="1"
              max={trtStagesCount}
              value={trtStageNumber}
              onChange={(e) => setTrtStageNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Progress Percentage ({trtProgress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={trtProgress}
                onChange={(e) => setTrtProgress(e.target.value)}
                className="w-full accent-teal-600 cursor-pointer mt-2"
              />
            </div>

            <Input
              label="Next Adjustment Target Date"
              type="date"
              value={trtNextAdjDate}
              onChange={(e) => setTrtNextAdjDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Case Status
            </label>
            <select
              value={trtStatus}
              onChange={(e) => setTrtStatus(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500"
            >
              <option value="ACTIVE">ACTIVE (Ongoing clinical care)</option>
              <option value="COMPLETED">COMPLETED (Treatment finalized & retainers delivered)</option>
              <option value="ON_HOLD">ON_HOLD (Temporarily paused)</option>
            </select>
          </div>

          {/* Reopen Checkpoint Validation */}
          {treatment?.status === 'COMPLETED' && trtStatus !== 'COMPLETED' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Validation Checkpoint: Reopening Completed Procedure</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                This clinical case was previously marked COMPLETED. State the clinical justification for reopening this plan to prevent accidental status reversal.
              </p>
              <textarea
                value={trtReopenReason}
                onChange={(e) => setTrtReopenReason(e.target.value)}
                rows={2}
                placeholder="e.g. Relapse observed in arch retention; additional alignment phase required..."
                className="w-full bg-surface-card border border-amber-300 dark:border-amber-700 rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-amber-500 resize-none"
                required
              />
            </div>
          )}

          {/* Completion Checkpoint Confirmation */}
          {trtStatus === 'COMPLETED' && treatment?.status !== 'COMPLETED' && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="treatmentCompletionCheckbox"
                checked={trtCompletionConfirmed}
                onChange={(e) => setTrtCompletionConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 border-surface-border focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="treatmentCompletionCheckbox" className="text-xs text-emerald-900 dark:text-emerald-200 cursor-pointer leading-snug">
                <strong>Completion Checkpoint:</strong> I confirm that all clinical milestones are finalized, appliances verified, and this case is ready to be locked as COMPLETED.
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Dentist Clinical Notes & Patient Instructions
            </label>
            <textarea
              value={trtNotes}
              onChange={(e) => setTrtNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Advised patient to wear class II intermaxillary elastics 24/7..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm text-ink-primary outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setIsEditTrtOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSavingTrt}
              rightIcon={Save}
            >
              Save & Notify Patient
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Finalize Patient Chart Checkpoint */}
      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        title="Patient Record Finalization Checkpoint"
        description="Verify completeness of patient chart before locking for clinical compliance."
      >
        <div className="space-y-4">
          {finalizeMissingFields.length > 0 ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-100">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Cannot Finalize Incomplete Record</span>
              </div>
              <p>
                The following mandatory clinical onboarding fields must be completed before this patient case file can be finalized:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-semibold">
                {finalizeMissingFields.map((field, idx) => (
                  <li key={idx}>{field}</li>
                ))}
              </ul>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                Please update the patient profile to supply these details prior to finalization.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-950 dark:text-teal-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-800 dark:text-teal-300">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Clinical Onboarding Validation Passed</span>
                </div>
                <p>
                  All required statutory fields (Full Legal Name, Valid Contact, Date of Birth, Emergency Contact, and RA 10173 Consent) have been verified.
                </p>
                <p className="text-[11px] text-teal-700 dark:text-teal-400">
                  <strong>Notice:</strong> Finalizing locks this patient&apos;s baseline chart into the clinic audit log. Future updates will require an authorized clinical amendment reason. Note that patient record completion is maintained separately from treatment completion.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsFinalizeModalOpen(false)}
            >
              {finalizeMissingFields.length > 0 ? 'Close & Review Profile' : 'Cancel'}
            </Button>
            {finalizeMissingFields.length === 0 && (
              <Button
                variant="primary"
                onClick={handleConfirmFinalize}
                loading={isActionLoading}
              >
                Confirm &amp; Finalize Chart
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL: Archive Case File */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        title={`Archive Patient Case File: ${patient.fullName}`}
        description="Safely archive inactive patient records while preserving full clinical audit history."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-amber-600 shrink-0" />
              Retention Notice:
            </p>
            <p>
              Archived records remain accessible for clinical review and statutory compliance. If this patient returns to the clinic, they can still book new appointments or be restored at any time.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Archive Reason / Category
            </label>
            <select
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-card text-ink-primary focus:border-teal-500 outline-none"
            >
              <option value="Historical Dental File Archive">
                Historical Dental File Archive
              </option>
              <option value="Treatment Series Completed / Case Discharged">
                Treatment Series Completed / Case Discharged
              </option>
              <option value="Patient Relocation / Inactive Roster">
                Patient Relocation / Inactive Roster
              </option>
              <option value="Other Administrative Archive">
                Other Administrative Archive
              </option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsArchiveModalOpen(false)}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleArchivePatient}
              loading={isActionLoading}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Archive Case File
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Restore Archived Case File */}
      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        title={`Restore Patient Record: ${patient.fullName}`}
        description="Reactivate an archived historical record back to the active clinic roster."
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-secondary">
            Restoring this case file will return the patient to the Active Patient Directory. All previous diagnostic imaging, odontograms, and treatment history will remain intact.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsRestoreModalOpen(false)}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRestorePatient}
              loading={isActionLoading}
            >
              Restore to Active Directory
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Assign Attending Dentist */}
      <Modal
        isOpen={isAssignDentistModalOpen}
        onClose={() => setIsAssignDentistModalOpen(false)}
        title="Assign Attending Dental Clinician"
        description="Assign or reassign the primary attending dentist responsible for this patient case."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Select Attending Dentist
            </label>
            <select
              value={targetDentistName}
              onChange={(e) => setTargetDentistName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-card text-ink-primary focus:border-teal-500 outline-none"
            >
              <option value="Dr. Tristan Jerho Belingon">Dr. Tristan Jerho Belingon (Prosthodontics & Oral Surgery)</option>
              <option value="Dr. Jay Villanueva">Dr. Jay Villanueva (General Dentistry & Endodontics)</option>
              <option value="Dr. Elena Ramos">Dr. Elena Ramos (Orthodontics & Pediatric Dentistry)</option>
              <option value="Dr. Marcus Vance">Dr. Marcus Vance (Periodontics & Implantology)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              variant="secondary"
              onClick={() => setIsAssignDentistModalOpen(false)}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignDentist}
              loading={isActionLoading}
            >
              Save Dentist Assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
