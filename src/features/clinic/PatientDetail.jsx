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
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { appointmentService } from '../../services/appointmentService';
import { treatmentService } from '../../services/treatmentService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/formatters';

export function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [treatment, setTreatment] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Lightbox for X-ray
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const [pat, appts, trt, recs] = await Promise.all([
          patientService.getById(id),
          appointmentService.listForPatient(id),
          treatmentService.getByPatientId(id),
          patientService.getRecords(id),
        ]);
        setPatient(pat);
        setAppointments(appts);
        setTreatment(trt);
        setRecords(recs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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
    { id: 'appointments', label: 'Appointments History', badge: appointments.length },
    { id: 'treatment', label: 'Orthodontic Plan' },
    { id: 'records', label: 'Radiology & X-Rays', badge: records.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Link to="/clinic/patients">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to Directory
          </Button>
        </Link>
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
                <span>{patient.phone || 'No phone'}</span>
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

      <Tabs tabs={detailTabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: Clinical Profile & Medical History */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-surface-border pb-3">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <h3 className="font-heading font-bold text-ink-primary text-base">
                Medical & Allergy Disclosures
              </h3>
            </div>
            <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border text-xs sm:text-sm text-ink-primary leading-relaxed">
              {patient.medicalHistory || 'No specific medical or drug allergies disclosed.'}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-surface-border pb-3">
              <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="font-heading font-bold text-ink-primary text-base">
                Emergency Contact Details
              </h3>
            </div>
            <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border text-xs sm:text-sm text-ink-primary leading-relaxed">
              {patient.emergencyContact || 'No emergency contact registered yet.'}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Appointments History */}
      {activeTab === 'appointments' && (
        <Card className="divide-y divide-surface-border/60">
          {appointments.length === 0 ? (
            <p className="p-8 text-center text-xs text-ink-muted">No appointments on file for this patient.</p>
          ) : (
            appointments.map((a) => (
              <div key={a.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-bold text-sm text-ink-primary">
                      {a.serviceName}
                    </p>
                    <Badge status={a.status} size="sm" showDot>
                      {a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    {formatDate(a.date)} at {a.timeSlot} • Dr. {a.dentistName}
                  </p>
                  {a.notes && <p className="text-[11px] text-ink-muted italic">&ldquo;{a.notes}&rdquo;</p>}
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* TAB 3: Treatment Plan */}
      {activeTab === 'treatment' && (
        <Card className="p-6 sm:p-8 space-y-5">
          {treatment ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-surface-border pb-3">
                <div>
                  <h3 className="text-lg font-heading font-bold text-ink-primary">
                    {treatment.treatmentType}
                  </h3>
                  <p className="text-xs text-ink-muted">Attending Specialist: {treatment.dentistName}</p>
                </div>
                <Badge variant="primary" size="md">
                  Stage {treatment.stageNumber} ({treatment.progressPercentage}% Complete)
                </Badge>
              </div>

              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs sm:text-sm text-ink-primary italic">
                Clinical Note: &ldquo;{treatment.dentistNotes}&rdquo;
              </div>
            </div>
          ) : (
            <p className="text-xs text-center text-ink-muted py-6">
              No active orthodontic treatment plan registered.
            </p>
          )}
        </Card>
      )}

      {/* TAB 4: Radiology & X-Rays */}
      {activeTab === 'records' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.length === 0 ? (
            <p className="text-xs text-ink-muted col-span-3 text-center py-6">
              No diagnostic imaging or X-rays available.
            </p>
          ) : (
            records.map((rec) => (
              <Card
                key={rec.id}
                hoverEffect
                onClick={() => setSelectedRecord(rec)}
                className="overflow-hidden cursor-pointer"
              >
                <div className="h-44 bg-slate-900 overflow-hidden">
                  <img src={rec.imageUrl} alt={rec.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 space-y-1">
                  <Badge variant="primary" size="sm">{rec.type}</Badge>
                  <p className="font-heading font-bold text-sm text-ink-primary">{rec.title}</p>
                  <p className="text-xs text-ink-muted">{formatDate(rec.date)}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord?.title}
        maxWidth="max-w-3xl"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[60vh]">
              <img src={selectedRecord.imageUrl} alt={selectedRecord.title} className="max-h-[55vh] object-contain" />
            </div>
            <p className="text-xs sm:text-sm text-ink-primary p-3 rounded-xl bg-surface-50">
              {selectedRecord.findings}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
