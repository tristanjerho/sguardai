/**
 * Core constants for SmileGuard
 */

export const APPOINTMENT_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const TREATMENT_STAGE = {
  INITIAL: 'INITIAL',
  IN_PROGRESS: 'IN_PROGRESS',
  ALIGNMENT: 'ALIGNMENT',
  RETENTION: 'RETENTION',
  COMPLETED: 'COMPLETED',
};

export const LAB_ORDER_STATUS = {
  RECEIVED: 'RECEIVED',
  DESIGN: 'DESIGN',
  MILLING: 'MILLING',
  GLAZING: 'GLAZING',
  QA: 'QA',
  DISPATCHED: 'DISPATCHED',
  // Backward compatibility aliases
  ORDERED: 'RECEIVED',
  IN_PROGRESS: 'DESIGN',
  READY: 'QA',
  DELIVERED: 'DISPATCHED',
};

export const LAB_ORDER_STAGES = [
  'RECEIVED',
  'DESIGN',
  'MILLING',
  'GLAZING',
  'QA',
  'DISPATCHED',
];

export const SERVICES = [
  {
    id: 'consultation',
    name: 'Consultation & Oral Exam',
    duration: '30 mins',
    price: '₱500',
    description: 'Comprehensive dental examination, oral assessment, and treatment planning.',
  },
  {
    id: 'cleaning',
    name: 'Prophylaxis (Cleaning)',
    duration: '45 mins',
    price: '₱1,200',
    description: 'Deep dental scaling, plaque and tartar removal, and polishing.',
  },
  {
    id: 'braces-adj',
    name: 'Braces Adjustment & Wire Tightening',
    duration: '30 mins',
    price: '₱1,000',
    description: 'Monthly wire adjustment, bracket check, and orthodontic progression.',
  },
  {
    id: 'braces-install',
    name: 'Braces Installation (Full Arch)',
    duration: '90 mins',
    price: '₱35,000',
    description: 'Direct bonding of ceramic or metal brackets and initial archwire placement.',
  },
  {
    id: 'extraction',
    name: 'Tooth Extraction',
    duration: '45 mins',
    price: '₱1,500',
    description: 'Gentle routine or surgical extraction with local anesthesia.',
  },
  {
    id: 'emergency',
    name: 'Emergency Dental Relief',
    duration: '30 mins',
    price: '₱800',
    description: 'Urgent pain relief, broken bracket repair, or trauma management.',
  },
];

export const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];
