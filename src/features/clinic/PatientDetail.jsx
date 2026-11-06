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
import { formatDate } from '../../lib/formatters';
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
  const [isSavingTrt, setIsSavingTrt] = useState(false);

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
        },
        user?.fullName || 'Attending Dentist'
      );
      setTreatment(updated);
      toast.success('Treatment plan updated successfully!');
      setIsEditTrtOpen(false);
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
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <Link to="/clinic/patients">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to Directory
          </Button>
        </Link>
        <Button
          variant="primary"
          size="sm"
          leftIcon={UploadCloud}
          onClick={() => setIsUploadOpen(true)}
        >
          Upload X-Ray / Dental Image
        </Button>
      </div>

      {/* Patient Top Summary Card */}
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-surface-card to-teal-50/40 dark:to-teal-950/20 shadow-soft-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar name={patient.fullName} size="xl" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              <h2 className="text-2xl font-heading font-extrabold text-ink-primary">
                {patient.fullName}
              </h2>
              {patient.isOnboarded ? (
                <Badge variant="success" size="sm">
                  Verified Chart (RA 10173)
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Incomplete Onboarding
                </Badge>
              )}
            </div>

            <p className="text-xs text-ink-muted">Patient ID: {patient.id} • {patient.email}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-ink-secondary">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Phone className="w-3.5 h-3.5 text-teal-600" />
                <span>{patient.phone || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>DOB: {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Consent: {patient.privacyConsent ? 'Granted' : 'Pending'}</span>
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
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                Medical History & Systemic Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-xs sm:text-sm text-ink-secondary leading-relaxed">
              {patient.medicalHistory ? (
                <p className="p-4 rounded-xl bg-surface-subtle border border-surface-border">
                  {patient.medicalHistory}
                </p>
              ) : (
                <p className="text-ink-muted italic">No systemic conditions or allergies recorded.</p>
              )}
            </CardContent>
          </Card>

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
                <Badge variant={appt.status === 'CONFIRMED' ? 'success' : appt.status === 'CANCELLED' ? 'danger' : 'warning'}>
                  {appt.status}
                </Badge>
              </div>
            ))
          )}
        </Card>
      )}

      {/* TAB 4: Treatment Plan */}
      {activeTab === 'treatment' && (
        <div className="space-y-6">
          {treatment ? (
            <Card className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-heading font-extrabold text-ink-primary">
                      {treatment.treatmentType || treatment.type || 'Clinical Treatment Plan'}
                    </h3>
                    <Badge variant={treatment.status === 'COMPLETED' ? 'success' : 'primary'}>
                      Stage {treatment.stageNumber || 1} of {treatment.totalStages || 4} ({treatment.stage})
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>Attending Doctor: <strong className="text-ink-primary">{treatment.dentistName || 'Staff Specialist'}</strong></span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-300">
                  {(treatment.stages && treatment.stages.length > 0
                    ? treatment.stages
                    : generateDefaultStages(treatment.treatmentType || treatment.type, treatment.totalStages || 4, treatment.stageNumber || 1, treatment.startDate)
                  ).map((stg) => {
                    const isDone = stg.status === 'COMPLETED';
                    const isCurrent = stg.status === 'IN_PROGRESS';

                    return (
                      <div key={stg.number} className="relative flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs z-10 flex-shrink-0 border-2 ${
                            isDone
                              ? 'bg-teal-600 border-teal-600 text-white shadow-soft'
                              : isCurrent
                              ? 'bg-surface-card border-teal-500 text-teal-600 ring-4 ring-teal-100 dark:ring-teal-900/40 shadow-glow'
                              : 'bg-surface-card border-surface-border text-ink-muted'
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-5 h-5" /> : stg.number}
                        </div>

                        <div className="flex-1 p-3.5 rounded-2xl border border-surface-border bg-surface-50/60 dark:bg-surface-100/30 space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h5 className="font-heading font-bold text-sm text-ink-primary">
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
                  className="h-8 px-2.5 text-xs font-semibold hidden sm:inline-flex"
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
                  className="h-8 px-2.5 text-xs font-semibold hidden sm:inline-flex"
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
              className={`relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 h-[45vh] sm:h-[60vh] flex items-center justify-center select-none ${zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                }`}
            >
              <div
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom}) rotate(${rotation}deg)`,
                  filter: `${isInverted ? 'invert(1) ' : ''}${isHighContrast ? 'contrast(1.6) brightness(1.1) ' : ''}`,
                  willChange: 'transform',
                  transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className="max-h-[42vh] sm:max-h-[56vh] max-w-[90vw] flex items-center justify-center origin-center pointer-events-none transform-gpu"
              >
                <img
                  src={selectedRecord.secureUrl || selectedRecord.imageUrl}
                  alt={selectedRecord.type}
                  draggable={false}
                  className="max-h-[40vh] sm:max-h-[54vh] w-auto object-contain rounded-xl shadow-2xl pointer-events-none select-none"
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
              accept="image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
              className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
            />
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
    </div>
  );
}
