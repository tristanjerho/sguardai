import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ROLES } from '../lib/roles';
import { TREATMENT_STAGE } from '../lib/constants';
import { activityLogService } from './activityLogService';

export const TEST_DATA_BATCH_ID = 'seed_demo_v1';
const DEFAULT_CLINIC_ID = 'clinic_main_01';

/**
 * Realistic Fictional Seed Datasets
 */
export const SEED_DENTISTS = [
  {
    id: 'dentist_tristan_belingon',
    email: 'dr.tristan@smileguard.clinic',
    fullName: 'Dr. Tristan Jerho Belingon',
    role: ROLES.DENTIST,
    specialty: 'Prosthodontics & Oral Surgery',
    licenseNumber: 'PRC-DEN-0084921',
    phone: '+63 917 555 0101',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
  {
    id: 'dentist_jay_villanueva',
    email: 'dr.jay@smileguard.clinic',
    fullName: 'Dr. Jay Villanueva',
    role: ROLES.DENTIST,
    specialty: 'General Dentistry & Endodontics',
    licenseNumber: 'PRC-DEN-0079144',
    phone: '+63 918 555 0102',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
  {
    id: 'dentist_elena_ramos',
    email: 'dr.elena@smileguard.clinic',
    fullName: 'Dr. Elena Ramos',
    role: ROLES.DENTIST,
    specialty: 'Orthodontics & Pediatric Dentistry',
    licenseNumber: 'PRC-DEN-0091203',
    phone: '+63 920 555 0103',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
  {
    id: 'dentist_marcus_vance',
    email: 'dr.marcus@smileguard.clinic',
    fullName: 'Dr. Marcus Vance',
    role: ROLES.DENTIST,
    specialty: 'Periodontics & Implantology',
    licenseNumber: 'PRC-DEN-0063810',
    phone: '+63 922 555 0104',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
];

export const SEED_RECEPTIONISTS = [
  {
    id: 'receptionist_maria_santos',
    email: 'maria.reception@smileguard.clinic',
    fullName: 'Maria Santos',
    role: ROLES.RECEPTIONIST,
    phone: '+63 927 555 0201',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
  {
    id: 'receptionist_sarah_gomez',
    email: 'sarah.reception@smileguard.clinic',
    fullName: 'Sarah Gomez',
    role: ROLES.RECEPTIONIST,
    phone: '+63 928 555 0202',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
];

export const SEED_ADMINS = [
  {
    id: 'admin_alex_reyes',
    email: 'alex.admin@smileguard.clinic',
    fullName: 'Alex Reyes',
    role: ROLES.ADMIN,
    phone: '+63 919 555 0301',
    clinicId: DEFAULT_CLINIC_ID,
    isActive: true,
  },
];

export const SEED_PATIENTS_ACTIVE = [
  {
    id: 'pat_tristan_belingon_active',
    patientCode: 'PT-1001',
    fullName: 'Tristan Belingon',
    email: 'tristan.belingon.demo@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 997 245 1681',
    dateOfBirth: '2004-10-07',
    gender: 'Male',
    bloodType: 'O+',
    privacyConsent: true,
    privacyConsentDate: '2026-01-15T09:30:00.000Z',
    emergencyContactName: 'Carmela Belingon',
    emergencyContactPhone: '+63 917 111 2233',
    emergencyContactRelation: 'Mother',
    medicalHistory: 'Mild penicillin sensitivity. No history of cardiovascular conditions or diabetes.',
    lastRootCanal: {
      timeframe: 'Over 2 years ago',
      exactDate: '2023-11-12',
    },
    assignedDentistId: 'dentist_tristan_belingon',
    assignedDentistName: 'Dr. Tristan Jerho Belingon',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_bea_alonzo_active',
    patientCode: 'PT-1002',
    fullName: 'Bea Alonzo-Tan',
    email: 'bea.tan.demo@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 917 234 5678',
    dateOfBirth: '1996-04-18',
    gender: 'Female',
    bloodType: 'A+',
    privacyConsent: true,
    privacyConsentDate: '2026-02-10T14:15:00.000Z',
    emergencyContactName: 'Richard Tan',
    emergencyContactPhone: '+63 918 444 5566',
    emergencyContactRelation: 'Spouse',
    medicalHistory: 'Asthma (managed with Ventolin inhaler). Regular prophylaxis patient.',
    lastRootCanal: {
      timeframe: 'Never undergone this procedure',
      exactDate: null,
    },
    assignedDentistId: 'dentist_elena_ramos',
    assignedDentistName: 'Dr. Elena Ramos',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_carlos_mendoza_active',
    patientCode: 'PT-1003',
    fullName: 'Carlos Mendoza',
    email: 'carlos.mendoza.demo@yahoo.com',
    role: ROLES.PATIENT,
    phone: '+63 918 345 6789',
    dateOfBirth: '1988-08-22',
    gender: 'Male',
    bloodType: 'B+',
    privacyConsent: true,
    privacyConsentDate: '2026-02-20T10:00:00.000Z',
    emergencyContactName: 'Grace Mendoza',
    emergencyContactPhone: '+63 919 666 7788',
    emergencyContactRelation: 'Sister',
    medicalHistory: 'Hypertension controlled with Amlodipine 5mg. Occasional gingival bleeding on lower molars.',
    lastRootCanal: {
      timeframe: '6 to 12 months ago',
      exactDate: '2025-08-14',
    },
    assignedDentistId: 'dentist_marcus_vance',
    assignedDentistName: 'Dr. Marcus Vance',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_danica_sotto_active',
    patientCode: 'PT-1004',
    fullName: 'Danica Sotto',
    email: 'danica.sotto.demo@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 920 456 7890',
    dateOfBirth: '2001-12-05',
    gender: 'Female',
    bloodType: 'AB+',
    privacyConsent: true,
    privacyConsentDate: '2026-03-01T11:45:00.000Z',
    emergencyContactName: 'Eduardo Sotto',
    emergencyContactPhone: '+63 921 777 8899',
    emergencyContactRelation: 'Father',
    medicalHistory: 'No known allergies or chronic systemic conditions. Orthodontic clear aligners candidate.',
    lastRootCanal: {
      timeframe: 'Never undergone this procedure',
      exactDate: null,
    },
    assignedDentistId: 'dentist_elena_ramos',
    assignedDentistName: 'Dr. Elena Ramos',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_emman_valdez_active',
    patientCode: 'PT-1005',
    fullName: 'Emmanuel Valdez',
    email: 'emman.valdez.demo@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 922 567 8901',
    dateOfBirth: '1979-05-30',
    gender: 'Male',
    bloodType: 'O-',
    privacyConsent: true,
    privacyConsentDate: '2026-03-05T15:20:00.000Z',
    emergencyContactName: 'Rowena Valdez',
    emergencyContactPhone: '+63 923 888 9900',
    emergencyContactRelation: 'Spouse',
    medicalHistory: 'Type 2 Diabetes (HbA1c 6.8%). Moderate localized chronic periodontitis.',
    lastRootCanal: {
      timeframe: '1 to 2 years ago',
      exactDate: '2024-04-10',
    },
    assignedDentistId: 'dentist_jay_villanueva',
    assignedDentistName: 'Dr. Jay Villanueva',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_fiona_cruz_active',
    patientCode: 'PT-1006',
    fullName: 'Fiona Cruz',
    email: 'fiona.cruz.demo@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 927 678 9012',
    dateOfBirth: '2005-09-14',
    gender: 'Female',
    bloodType: 'O+',
    privacyConsent: true,
    privacyConsentDate: '2026-03-12T09:00:00.000Z',
    emergencyContactName: 'Lourdes Cruz',
    emergencyContactPhone: '+63 928 999 0011',
    emergencyContactRelation: 'Mother',
    medicalHistory: 'Impacted wisdom teeth discomfort on lower right quadrant. Requires surgical consultation.',
    lastRootCanal: {
      timeframe: 'Never undergone this procedure',
      exactDate: null,
    },
    assignedDentistId: 'dentist_tristan_belingon',
    assignedDentistName: 'Dr. Tristan Jerho Belingon',
    recordStatus: 'FINALIZED',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_gabriel_lim_incomplete',
    patientCode: 'PT-1007',
    fullName: 'Gabriel Lim',
    email: 'gabriel.lim.draft@gmail.com',
    role: ROLES.PATIENT,
    phone: '+63 928 789 0123',
    dateOfBirth: '', // Incomplete to test validation checkpoint!
    gender: 'Male',
    privacyConsent: false, // Consent pending
    emergencyContactName: '',
    medicalHistory: '',
    recordStatus: 'DRAFT',
    isArchived: false,
    clinicId: DEFAULT_CLINIC_ID,
  },
];

/**
 * Historical Patient Case Files (2010 to 2015)
 * For capstone defense testing of archiving, audit retention, and active re-booking edge case.
 */
export const SEED_PATIENTS_HISTORICAL = [
  {
    id: 'pat_historical_2011_antonio',
    patientCode: 'PT-2011',
    fullName: 'Antonio Luna',
    email: 'antonio.luna.hist2011@archive.clinic',
    role: ROLES.PATIENT,
    phone: '+63 915 201 1001',
    dateOfBirth: '1965-10-29',
    gender: 'Male',
    bloodType: 'A+',
    privacyConsent: true,
    privacyConsentDate: '2011-03-14T08:00:00.000Z',
    emergencyContactName: 'Joaquin Luna',
    emergencyContactPhone: '+63 915 201 1099',
    medicalHistory: 'Full upper and lower acrylic dentures placed in 2011. Case closed upon relocation.',
    recordStatus: 'FINALIZED',
    isArchived: true,
    archivedAt: '2011-11-20T10:00:00.000Z',
    archivedReason: 'Historical Dental File Archive',
    archivedBy: 'Admin Alex Reyes',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_historical_2012_corazon',
    patientCode: 'PT-2012',
    fullName: 'Corazon Aquino-Salvador',
    email: 'corazon.salvador.hist2012@archive.clinic',
    role: ROLES.PATIENT,
    phone: '+63 916 201 2002',
    dateOfBirth: '1970-01-25',
    gender: 'Female',
    bloodType: 'B+',
    privacyConsent: true,
    privacyConsentDate: '2012-05-18T09:30:00.000Z',
    emergencyContactName: 'Manuel Salvador',
    emergencyContactPhone: '+63 916 201 2099',
    medicalHistory: 'Completed 3-unit PFM bridge teeth #13-#15 in June 2012. Patient moved abroad.',
    recordStatus: 'FINALIZED',
    isArchived: true,
    archivedAt: '2012-12-15T14:20:00.000Z',
    archivedReason: 'Historical Dental File Archive',
    archivedBy: 'Admin Alex Reyes',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_historical_2014_ramon',
    patientCode: 'PT-2014',
    fullName: 'Ramon Magsaysay Jr.',
    email: 'ramon.jr.hist2014@archive.clinic',
    role: ROLES.PATIENT,
    phone: '+63 917 201 4003',
    dateOfBirth: '1958-08-31',
    gender: 'Male',
    bloodType: 'O+',
    privacyConsent: true,
    privacyConsentDate: '2014-02-11T11:00:00.000Z',
    emergencyContactName: 'Luz Magsaysay',
    emergencyContactPhone: '+63 917 201 4099',
    medicalHistory: 'Comprehensive scaling and root planing completed in 2014. No active complaints at discharge.',
    recordStatus: 'FINALIZED',
    isArchived: true,
    archivedAt: '2014-09-30T16:00:00.000Z',
    archivedReason: 'Historical Dental File Archive',
    archivedBy: 'Admin Alex Reyes',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'pat_historical_2015_teresa_active_edge',
    patientCode: 'PT-2015',
    fullName: 'Teresa Magbanua',
    email: 'teresa.magbanua.hist2015@archive.clinic',
    role: ROLES.PATIENT,
    phone: '+63 918 201 5004',
    dateOfBirth: '1984-11-13',
    gender: 'Female',
    bloodType: 'AB+',
    privacyConsent: true,
    privacyConsentDate: '2015-04-10T10:15:00.000Z',
    emergencyContactName: 'Mariano Magbanua',
    emergencyContactPhone: '+63 918 201 5099',
    medicalHistory: 'Former root canal therapy on tooth #26 in 2015. Reconnected in 2026 for preventive checkup.',
    recordStatus: 'FINALIZED',
    isArchived: true,
    archivedAt: '2015-10-25T11:30:00.000Z',
    archivedReason: 'Historical Dental File Archive',
    archivedBy: 'Admin Alex Reyes',
    clinicId: DEFAULT_CLINIC_ID,
    hasActiveFollowUpAppointment: true, // Specific edge case test!
  },
];

/**
 * Appointments spanning all 6 statuses and multiple dentists
 */
export const SEED_APPOINTMENTS = [
  // 1. PENDING triage
  {
    id: 'apt_demo_pending_01',
    patientId: 'pat_tristan_belingon_active',
    patientName: 'Tristan Belingon',
    patientEmail: 'tristan.belingon.demo@gmail.com',
    dentistId: 'dentist_tristan_belingon',
    dentistName: 'Dr. Tristan Jerho Belingon',
    serviceName: 'Dental Consultation & Comprehensive Triage',
    serviceType: 'CONSULTATION',
    date: '2026-11-10',
    timeSlot: '09:00 AM',
    status: 'PENDING',
    notes: 'Experiencing sensitivity when drinking cold water on upper right molars.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'apt_demo_pending_02',
    patientId: 'pat_fiona_cruz_active',
    patientName: 'Fiona Cruz',
    patientEmail: 'fiona.cruz.demo@gmail.com',
    dentistId: 'dentist_tristan_belingon',
    dentistName: 'Dr. Tristan Jerho Belingon',
    serviceName: 'Tooth Extraction & Socket Management',
    serviceType: 'EXTRACTION',
    date: '2026-11-11',
    timeSlot: '10:00 AM',
    status: 'PENDING',
    notes: 'Lower right wisdom tooth feels impacted and tender.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 2. CONFIRMED with SMS dispatched
  {
    id: 'apt_demo_confirmed_01',
    patientId: 'pat_bea_alonzo_active',
    patientName: 'Bea Alonzo-Tan',
    patientEmail: 'bea.tan.demo@gmail.com',
    dentistId: 'dentist_elena_ramos',
    dentistName: 'Dr. Elena Ramos',
    serviceName: 'Orthodontic Braces Adjustment & Wire Replacement',
    serviceType: 'ORTHODONTICS',
    date: '2026-11-09',
    timeSlot: '11:00 AM',
    status: 'CONFIRMED',
    confirmedBy: 'Dr. Elena Ramos',
    confirmedAt: '2026-11-08T08:30:00.000Z',
    notes: 'Scheduled round wire progression step 3.',
    smsSent: true,
    smsDispatchedAt: '2026-11-08T08:30:05.000Z',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'apt_demo_confirmed_02',
    patientId: 'pat_carlos_mendoza_active',
    patientName: 'Carlos Mendoza',
    patientEmail: 'carlos.mendoza.demo@yahoo.com',
    dentistId: 'dentist_marcus_vance',
    dentistName: 'Dr. Marcus Vance',
    serviceName: 'Periodontal Scaling & Root Planing',
    serviceType: 'PERIODONTICS',
    date: '2026-11-09',
    timeSlot: '02:00 PM',
    status: 'CONFIRMED',
    confirmedBy: 'Dr. Marcus Vance',
    confirmedAt: '2026-11-08T09:10:00.000Z',
    notes: 'Deep quadrant scaling for teeth #44-#47.',
    smsSent: true,
    smsDispatchedAt: '2026-11-08T09:10:03.000Z',
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 3. COMPLETED
  {
    id: 'apt_demo_completed_01',
    patientId: 'pat_tristan_belingon_active',
    patientName: 'Tristan Belingon',
    patientEmail: 'tristan.belingon.demo@gmail.com',
    dentistId: 'dentist_jay_villanueva',
    dentistName: 'Dr. Jay Villanueva',
    serviceName: 'Oral Prophylaxis (Cleaning) & Fluoride Application',
    serviceType: 'CLEANING',
    date: '2026-11-07',
    timeSlot: '09:00 AM',
    status: 'COMPLETED',
    completedAt: '2026-11-07T10:05:00.000Z',
    notes: 'Full mouth scaling completed successfully. Mild supragingival calculus removed.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'apt_demo_completed_02',
    patientId: 'pat_emman_valdez_active',
    patientName: 'Emmanuel Valdez',
    patientEmail: 'emman.valdez.demo@gmail.com',
    dentistId: 'dentist_jay_villanueva',
    dentistName: 'Dr. Jay Villanueva',
    serviceName: 'Composite Light-Cure Dental Restoration (Pasta)',
    serviceType: 'RESTORATION',
    date: '2026-11-06',
    timeSlot: '03:00 PM',
    status: 'COMPLETED',
    completedAt: '2026-11-06T16:15:00.000Z',
    notes: 'Class I restoration on tooth #16 occlusal surface using A2 shade resin.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 4. CANCELLED by patient
  {
    id: 'apt_demo_cancelled_01',
    patientId: 'pat_danica_sotto_active',
    patientName: 'Danica Sotto',
    patientEmail: 'danica.sotto.demo@gmail.com',
    dentistId: 'dentist_elena_ramos',
    dentistName: 'Dr. Elena Ramos',
    serviceName: 'Clear Aligners Milestone Impression',
    serviceType: 'ORTHODONTICS',
    date: '2026-11-05',
    timeSlot: '01:00 PM',
    status: 'CANCELLED',
    cancelledAt: '2026-11-04T17:00:00.000Z',
    cancelledBy: 'Danica Sotto',
    cancelReason: 'Patient had an emergency family obligation outside Metro Manila.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 5. REJECTED / DECLINED with clinical rationale
  {
    id: 'apt_demo_declined_01',
    patientId: 'pat_carlos_mendoza_active',
    patientName: 'Carlos Mendoza',
    patientEmail: 'carlos.mendoza.demo@yahoo.com',
    dentistId: 'dentist_tristan_belingon',
    dentistName: 'Dr. Tristan Jerho Belingon',
    serviceName: 'Direct Surgical Extraction',
    serviceType: 'EXTRACTION',
    date: '2026-11-04',
    timeSlot: '10:00 AM',
    status: 'REJECTED',
    declinedCategory: 'Pre-procedure dental X-ray / records required first',
    declinedNotes: 'Patient requested direct surgical extraction without prior panoramic radiograph. Advised to book diagnostic imaging first.',
    declinedBy: 'Dr. Tristan Jerho Belingon',
    declinedAt: '2026-11-03T11:20:00.000Z',
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 6. RESCHEDULED with audit trail
  {
    id: 'apt_demo_rescheduled_01',
    patientId: 'pat_bea_alonzo_active',
    patientName: 'Bea Alonzo-Tan',
    patientEmail: 'bea.tan.demo@gmail.com',
    dentistId: 'dentist_elena_ramos',
    dentistName: 'Dr. Elena Ramos',
    serviceName: 'Orthodontic Braces Alignment',
    serviceType: 'ORTHODONTICS',
    date: '2026-11-12',
    timeSlot: '04:00 PM',
    status: 'CONFIRMED',
    rescheduleHistory: [
      {
        previousDate: '2026-11-08',
        previousTimeSlot: '10:00 AM',
        newDate: '2026-11-12',
        newTimeSlot: '04:00 PM',
        rescheduledBy: 'Maria Santos (Front Desk)',
        reason: 'Dentist Schedule Adjustment / Surgery Extension',
        timestamp: '2026-11-07T14:30:00.000Z',
      },
    ],
    clinicId: DEFAULT_CLINIC_ID,
  },
  // 7. HISTORICAL PATIENT RE-BOOKING 2026 EDGE CASE
  {
    id: 'apt_demo_historical_edge_01',
    patientId: 'pat_historical_2015_teresa_active_edge',
    patientName: 'Teresa Magbanua',
    patientEmail: 'teresa.magbanua.hist2015@archive.clinic',
    dentistId: 'dentist_jay_villanueva',
    dentistName: 'Dr. Jay Villanueva',
    serviceName: 'Comprehensive Clinical & Endodontic Follow-Up Examination',
    serviceType: 'CONSULTATION',
    date: '2026-11-15',
    timeSlot: '02:00 PM',
    status: 'CONFIRMED',
    notes: 'Reconnecting patient from 2015 archive. Checking periapical status of tooth #26 treated in 2015.',
    clinicId: DEFAULT_CLINIC_ID,
  },
];

/**
 * Treatment Plans across stages
 */
export const SEED_TREATMENTS = [
  {
    id: 'trt_demo_ortho_bea',
    patientId: 'pat_bea_alonzo_active',
    patientName: 'Bea Alonzo-Tan',
    treatmentType: 'Ortho Braces (Fixed Orthodontic Alignment)',
    stage: TREATMENT_STAGE.ALIGNMENT,
    stageProgress: 45,
    totalStagesCount: 6,
    dentistName: 'Dr. Elena Ramos',
    dentistId: 'dentist_elena_ramos',
    startDate: '2025-09-01',
    nextAdjustmentDate: '2026-11-09',
    estimatedCompletionDate: '2027-03-31',
    notes: 'Leveling and aligning stage. Upper 0.016 NiTi wire engaged. Patient complying with oral hygiene.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'trt_demo_perio_carlos',
    patientId: 'pat_carlos_mendoza_active',
    patientName: 'Carlos Mendoza',
    treatmentType: 'Oral Prophylaxis & Periodontal Maintenance',
    stage: TREATMENT_STAGE.IN_PROGRESS,
    stageProgress: 60,
    totalStagesCount: 4,
    dentistName: 'Dr. Marcus Vance',
    dentistId: 'dentist_marcus_vance',
    startDate: '2026-02-15',
    nextAdjustmentDate: '2026-11-09',
    estimatedCompletionDate: '2027-02-15',
    notes: 'Subgingival ultrasonic debridement complete on quadrants 1 and 2. Probing depth reduced by 2mm.',
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'trt_demo_endo_tristan',
    patientId: 'pat_tristan_belingon_active',
    patientName: 'Tristan Belingon',
    treatmentType: 'CROWNS, Bridges (Fixed Prosthodontics)',
    stage: TREATMENT_STAGE.COMPLETED,
    stageProgress: 100,
    totalStagesCount: 4,
    dentistName: 'Dr. Tristan Jerho Belingon',
    dentistId: 'dentist_tristan_belingon',
    startDate: '2025-10-10',
    completionDate: '2026-01-20',
    notes: 'Monolithic Zirconia crown cemented on tooth #36 with resin modified glass ionomer. Margin fit confirmed.',
    clinicId: DEFAULT_CLINIC_ID,
  },
];

/**
 * Diagnostic Radiographs & AI Assessments
 */
export const SEED_RADIOGRAPHS = [
  {
    id: 'img_demo_caries_01',
    patientId: 'pat_tristan_belingon_active',
    patientName: 'Tristan Belingon',
    type: 'PANORAMIC',
    imageUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80',
    toothNumbers: ['14', '36'],
    uploadedBy: 'Dr. Tristan Jerho Belingon',
    dentistId: 'dentist_tristan_belingon',
    aiAssessment: {
      predictedCondition: 'Dental Caries',
      confidencePercentage: 94.2,
      riskLevel: 'Moderate to High',
      summary: 'Interproximal radiolucency observed on tooth #14 distal surface extending into outer third of dentin. Tooth #36 occlusal enamel demineralization.',
      dentistReviewed: true,
      reviewedBy: 'Dr. Tristan Jerho Belingon',
      dentistConclusion: 'CONFIRMED',
      dentistNotes: 'Visual chairside inspection confirms cavitation on 14-D. Scheduled for composite restoration.',
      reviewedAt: '2026-11-07T14:00:00.000Z',
    },
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'img_demo_impacted_02',
    patientId: 'pat_fiona_cruz_active',
    patientName: 'Fiona Cruz',
    type: 'PANORAMIC',
    imageUrl: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=1200&q=80',
    toothNumbers: ['38', '48'],
    uploadedBy: 'Dr. Tristan Jerho Belingon',
    dentistId: 'dentist_tristan_belingon',
    aiAssessment: {
      predictedCondition: 'Impacted Teeth',
      confidencePercentage: 96.8,
      riskLevel: 'High',
      summary: 'Mesioangular impaction of lower right third molar (tooth #48) abutting crown of second molar. Horizontal impaction on tooth #38 with root proximity to inferior alveolar canal.',
      dentistReviewed: true,
      reviewedBy: 'Dr. Tristan Jerho Belingon',
      dentistConclusion: 'SURGICAL_EXTRACTION_RECOMMENDED',
      dentistNotes: 'CBCT or surgical assessment advised prior to odontectomy.',
      reviewedAt: '2026-11-06T16:30:00.000Z',
    },
    clinicId: DEFAULT_CLINIC_ID,
  },
  {
    id: 'img_demo_infection_03',
    patientId: 'pat_carlos_mendoza_active',
    patientName: 'Carlos Mendoza',
    type: 'PERIAPICAL',
    imageUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    toothNumbers: ['46'],
    uploadedBy: 'Dr. Marcus Vance',
    dentistId: 'dentist_marcus_vance',
    aiAssessment: {
      predictedCondition: 'Infection',
      confidencePercentage: 91.5,
      riskLevel: 'High',
      summary: 'Well-circumscribed periapical radiolucency around distal root apex of tooth #46 consistent with chronic periapical periodontitis / lesion.',
      dentistReviewed: false,
      dentistConclusion: 'PENDING_REVIEW',
      clinicId: DEFAULT_CLINIC_ID,
    },
    clinicId: DEFAULT_CLINIC_ID,
  },
];

/**
 * Service to populate, inspect, and safely purge demonstration test data
 */
export const seedService = {
  /**
   * Seeds full realistic dental clinic test data.
   * Idempotent: Overwrites existing demo items with identical IDs without duplicating records.
   * Every record is explicitly tagged with `isTestData: true`.
   * @param {string} [actorName='System Administrator']
   * @returns {Promise<Object>} Statistics of records written
   */
  async seedTestData(actorName = 'System Administrator') {
    if (!db) throw new Error('Firestore database is not initialized.');

    const stats = {
      dentists: 0,
      receptionists: 0,
      admins: 0,
      patientsActive: 0,
      patientsHistorical: 0,
      appointments: 0,
      treatments: 0,
      radiographs: 0,
    };

    // 1. Seed Dentists
    for (const d of SEED_DENTISTS) {
      const ref = doc(db, 'users', d.id);
      await setDoc(ref, {
        ...d,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.dentists += 1;
    }

    // 2. Seed Receptionists
    for (const r of SEED_RECEPTIONISTS) {
      const ref = doc(db, 'users', r.id);
      await setDoc(ref, {
        ...r,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.receptionists += 1;
    }

    // 3. Seed Admins
    for (const a of SEED_ADMINS) {
      const ref = doc(db, 'users', a.id);
      await setDoc(ref, {
        ...a,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.admins += 1;
    }

    // 4. Seed Active Patients
    for (const p of SEED_PATIENTS_ACTIVE) {
      const ref = doc(db, 'users', p.id);
      await setDoc(ref, {
        ...p,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.patientsActive += 1;
    }

    // 5. Seed Historical Patients (2010 to 2015)
    for (const hp of SEED_PATIENTS_HISTORICAL) {
      const ref = doc(db, 'users', hp.id);
      await setDoc(ref, {
        ...hp,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.patientsHistorical += 1;
    }

    // 6. Seed Appointments
    for (const apt of SEED_APPOINTMENTS) {
      const ref = doc(db, 'appointments', apt.id);
      await setDoc(ref, {
        ...apt,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.appointments += 1;
    }

    // 7. Seed Treatment Plans
    for (const trt of SEED_TREATMENTS) {
      const ref = doc(db, 'treatmentPlans', trt.id);
      await setDoc(ref, {
        ...trt,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      stats.treatments += 1;
    }

    // 8. Seed Radiographs & AI Assessments
    for (const rad of SEED_RADIOGRAPHS) {
      const ref = doc(db, 'dentalImages', rad.id);
      await setDoc(ref, {
        ...rad,
        isTestData: true,
        testDataBatch: TEST_DATA_BATCH_ID,
        uploadedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      stats.radiographs += 1;
    }

    // Audit Log
    try {
      await activityLogService.log({
        userId: 'admin_seed_process',
        action: 'SYSTEM_TEST_DATA_POPULATED',
        resourceType: 'SYSTEM',
        resourceId: TEST_DATA_BATCH_ID,
        entity: `Populated ${stats.patientsActive + stats.patientsHistorical} patients, ${stats.dentists} dentists, and ${stats.appointments} appointments (by ${actorName})`,
      });
    } catch (e) {
      console.warn('Non-critical log error:', e);
    }

    return stats;
  },

  /**
   * Safely purges only test data marked with `isTestData: true`.
   * Preserves genuine patient records, clinical charts, and doctor accounts.
   * @param {string} [actorName='System Administrator']
   * @returns {Promise<Object>} Statistics of purged records
   */
  async purgeTestData(actorName = 'System Administrator') {
    if (!db) throw new Error('Firestore database is not initialized.');

    const targetCollections = [
      'appointments',
      'treatmentPlans',
      'dentalImages',
      'odontograms',
      'notifications',
      'smsLogs',
      'users',
    ];

    const purgedCounts = {};

    for (const colName of targetCollections) {
      purgedCounts[colName] = 0;
      try {
        const q = query(collection(db, colName), where('isTestData', '==', true));
        const snapshot = await getDocs(q);
        const docsToDelete = snapshot.docs;

        // Process in chunks of 400 for Firestore batch limits
        const chunkSize = 400;
        for (let i = 0; i < docsToDelete.length; i += chunkSize) {
          const chunk = docsToDelete.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
          purgedCounts[colName] += chunk.length;
        }
      } catch (err) {
        console.warn(`Error purging collection ${colName}:`, err);
      }
    }

    try {
      await activityLogService.log({
        userId: 'admin_purge_process',
        action: 'SYSTEM_TEST_DATA_PURGED',
        resourceType: 'SYSTEM',
        resourceId: TEST_DATA_BATCH_ID,
        entity: `Safely purged test data across collections (by ${actorName})`,
      });
    } catch (e) {
      console.warn('Non-critical log error:', e);
    }

    return purgedCounts;
  },

  /**
   * Counts current test data vs real data
   * @returns {Promise<Object>}
   */
  async getTestDataStats() {
    if (!db) return { testCount: 0, totalCount: 0 };
    try {
      const collectionsToCheck = ['users', 'appointments', 'treatmentPlans', 'dentalImages'];
      const stats = {};
      let totalTest = 0;

      for (const colName of collectionsToCheck) {
        const qTest = query(collection(db, colName), where('isTestData', '==', true));
        const snapTest = await getDocs(qTest);
        const count = snapTest.size;
        stats[colName] = count;
        totalTest += count;
      }

      return {
        collections: stats,
        totalTestRecords: totalTest,
      };
    } catch (err) {
      console.warn('Could not read test data stats:', err);
      return { totalTestRecords: 0, collections: {} };
    }
  },
};
