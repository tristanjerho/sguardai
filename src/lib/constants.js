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
  PENDING_REVIEW: 'PENDING_REVIEW',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  DECLINED: 'DECLINED',
  ACCEPTED: 'ACCEPTED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  QUALITY_CHECK: 'QUALITY_CHECK',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  DISPATCHED: 'DISPATCHED',
  ISSUE_REPORTED: 'ISSUE_REPORTED',
  COMPLETED: 'COMPLETED',
  // Backward compatibility aliases
  REVISION_NEEDED: 'CLARIFICATION_REQUESTED',
  RECEIVED: 'ACCEPTED',
  DESIGN: 'IN_PRODUCTION',
  MILLING: 'IN_PRODUCTION',
  GLAZING: 'IN_PRODUCTION',
  QA: 'QUALITY_CHECK',
  ORDERED: 'PENDING_REVIEW',
  IN_PROGRESS: 'IN_PRODUCTION',
  READY: 'READY_FOR_DISPATCH',
  DELIVERED: 'COMPLETED',
};

export const LAB_ORDER_STAGES = [
  'CASE_PREPARATION',
  'CAD_DESIGN',
  'CAM_MILLING_PRINT',
  'FINISHING_STAIN_GLAZE',
  'QUALITY_CHECK',
  'READY_FOR_DISPATCH',
];

export const LAB_MATERIALS = [
  'Multilayer Zirconia',
  'Lithium Disilicate (IPS e.max)',
  'Porcelain-Fused-to-Metal (PFM)',
  'PMMA Orthodontic Acrylic + .028 SS Wire',
  'Thermoformed Clear PETG (1.0mm)',
  'High-Impact Heat-Cured Denture Acrylic',
  'Flexible Polyamide (Valplast)',
  'Autopolymerizing Repair Acrylic / Wrought Wire',
  'Dual-Laminate Hard/Soft Splint Material',
  '3D Printed Surgical / Model Resin',
];

export const VITA_SHADES = [
  'BL1', 'BL2', 'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'C1', 'C2', 'D2', 'D3',
  'Clear / Pink Acrylic', 'Match Existing', 'Clear / N/A',
];

export const SERVICES = [
  {
    id: 'oral-prophylaxis',
    name: 'Oral Prophylaxis (Cleaning)',
    duration: '30-45 mins',
    description: 'Comprehensive dental scaling, plaque and tartar removal, stain removal, and polishing.',
    pricingNote: 'Fee depends on the extent of calculus buildup and gum health',
  },
  {
    id: 'dental-fillings',
    name: 'Dental Fillings (Pasta)',
    duration: '30-60 mins',
    description: 'Tooth-colored composite restoration to repair dental caries, cavities, or fractured surfaces.',
    pricingNote: 'Fee depends on whether tooth damage is slight, moderate, or severe',
  },
  {
    id: 'crowns-bridges',
    name: 'Crowns, Bridges',
    duration: '60-90 mins',
    description: 'Fixed prosthetic restorations to reinforce badly damaged teeth or replace missing teeth.',
    pricingNote: 'Fee depends on remaining tooth structure, material, and number of units',
  },
  {
    id: 'root-canal',
    name: 'Root Canal Treatment',
    duration: '60-90 mins',
    description: 'Endodontic procedure to clean infected pulp tissue, relieve toothache, and save the natural tooth.',
    pricingNote: 'Fee depends on canal anatomy and degree of pulpal infection/damage',
  },
  {
    id: 'partial-denture',
    name: 'Removable Partial Denture',
    duration: '45-60 mins',
    description: 'Removable prosthetic appliance designed to replace several missing teeth and restore bite function.',
    pricingNote: 'Fee depends on the number of missing teeth and framework material',
  },
  {
    id: 'complete-denture',
    name: 'Complete Denture',
    duration: '60 mins',
    description: 'Full arch prosthetic replacement for completely edentulous upper or lower arches.',
    pricingNote: 'Fee depends on arch condition and prosthetic specifications',
  },
  {
    id: 'flexible-denture',
    name: 'Flexible Denture',
    duration: '45-60 mins',
    description: 'Nylon-based flexible partial denture offering enhanced comfort, aesthetics, and metal-free fit.',
    pricingNote: 'Fee depends on span of missing teeth and clinical impression',
  },
  {
    id: 'ortho-braces',
    name: 'Ortho Braces',
    duration: '45-60 mins',
    description: 'Orthodontic assessment, bracket bonding, or alignment adjustments for malocclusion and spacing.',
    pricingNote: 'Fee depends on case complexity and malocclusion severity',
  },
  {
    id: 'tooth-extraction',
    name: 'Tooth Extraction',
    duration: '30-45 mins',
    description: 'Gentle routine or surgical extraction of severely compromised, decayed, or impacted teeth.',
    pricingNote: 'Fee depends on tooth condition, root curvature, and surgical complexity',
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
