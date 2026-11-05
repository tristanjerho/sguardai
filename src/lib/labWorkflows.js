/**
 * SmileGuard AI — Service-Specific Dental Laboratory Workflow Engine
 *
 * Supports Orthodontics, Prosthodontics (Digital CAD/CAM & Conventional),
 * Removable Dentures (with Clinic Try-In loop), Repairs/Modifications,
 * and Admin-Configurable Custom Appliance Workflows without forcing every case through CAD/CAM.
 */

import { ROLES } from './roles.js';

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

  // Backward-compatible legacy aliases (non-destructive mapping)
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

export const STATUS_DISPLAY_LABELS = {
  PENDING_REVIEW: 'Pending Review',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  DECLINED: 'Declined',
  ACCEPTED: 'Accepted',
  IN_PRODUCTION: 'In Production',
  QUALITY_CHECK: 'Quality Check',
  READY_FOR_DISPATCH: 'Ready for Pickup',
  DISPATCHED: 'Dispatched / In Transit',
  ISSUE_REPORTED: 'Issue Reported',
  COMPLETED: 'Completed',
};

export const MATERIALS_STATUS = {
  AWAITING_MATERIALS: 'AWAITING_MATERIALS',
  READY_FOR_PRODUCTION: 'READY_FOR_PRODUCTION',
};

export const MATERIALS_DISPLAY_LABELS = {
  AWAITING_MATERIALS: 'Awaiting Materials',
  READY_FOR_PRODUCTION: 'Ready for Production',
};

export const DISPATCH_SUB_STATUS = {
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  IN_TRANSIT: 'IN_TRANSIT',
  AWAITING_CLINIC_RECEIPT: 'AWAITING_CLINIC_RECEIPT',
};

export const DISPATCH_SUB_LABELS = {
  READY_FOR_PICKUP: 'Ready for Pickup',
  IN_TRANSIT: 'Dispatched / In Transit',
  AWAITING_CLINIC_RECEIPT: 'Awaiting Clinic Receipt',
};

export const INPUT_SUBMISSION_TYPES = [
  {
    value: 'DIGITAL_SCAN',
    label: 'Intraoral Digital Scan (STL / PLY) — Ready Immediately',
    requiresPhysicalArrival: false,
  },
  {
    value: 'PHYSICAL_IMPRESSION',
    label: 'Physical Alginate / PVS Impression — Courier to Lab',
    requiresPhysicalArrival: true,
  },
  {
    value: 'STONE_MODEL',
    label: 'Poured Stone Model & Bite Registration — Physical Delivery',
    requiresPhysicalArrival: true,
  },
  {
    value: 'EXISTING_APPLIANCE',
    label: 'Existing Patient Appliance (For Repair / Reline)',
    requiresPhysicalArrival: true,
  },
  {
    value: 'PRESCRIPTION_ONLY',
    label: 'Rx Specification Only (Existing Cast / Scan on File)',
    requiresPhysicalArrival: false,
  },
];

export const APPLIANCE_CATEGORIES = {
  ORTHO_RETAINERS: 'ORTHO_RETAINERS',
  CROWNS_BRIDGES: 'CROWNS_BRIDGES',
  DENTURES: 'DENTURES',
  REPAIRS_MODIFICATIONS: 'REPAIRS_MODIFICATIONS',
  OTHER: 'OTHER',
};

export const APPLIANCE_CATEGORY_LABELS = {
  [APPLIANCE_CATEGORIES.ORTHO_RETAINERS]: 'Orthodontic Retainers & Appliances',
  [APPLIANCE_CATEGORIES.CROWNS_BRIDGES]: 'Crowns & Bridges',
  [APPLIANCE_CATEGORIES.DENTURES]: 'Removable Dentures',
  [APPLIANCE_CATEGORIES.REPAIRS_MODIFICATIONS]: 'Repairs & Modifications',
  [APPLIANCE_CATEGORIES.OTHER]: 'Other / Custom Appliances',
};

export const DENTAL_ARCHES = [
  { value: 'NOT_SPECIFIED', label: 'Specific Teeth Only' },
  { value: 'UPPER_ARCH', label: 'Upper Arch (Maxillary)' },
  { value: 'LOWER_ARCH', label: 'Lower Arch (Mandibular)' },
  { value: 'BOTH_ARCHES', label: 'Both Arches (Upper & Lower)' },
];

export const DENTAL_ARCH_LABELS = {
  NOT_SPECIFIED: '',
  UPPER_ARCH: 'Upper Arch',
  LOWER_ARCH: 'Lower Arch',
  BOTH_ARCHES: 'Upper & Lower Arches',
};

/**
 * Built-in Service-Specific Production Workflow Templates (Phase 3)
 * Note: Final two milestones ('Quality Check' and 'Ready for Dispatch') align
 * with the primary request lifecycle gates (QUALITY_CHECK and READY_FOR_DISPATCH / DISPATCHED).
 */
export const DEFAULT_WORKFLOW_TEMPLATES = {
  ORTHO_RETAINERS: {
    id: 'ORTHO_RETAINERS',
    name: 'Workflow A — Orthodontic Retainers',
    shortName: 'Orthodontic Retainers',
    category: APPLIANCE_CATEGORIES.ORTHO_RETAINERS,
    description: 'Hawley retainers (wire bending & acrylic processing), clear thermoformed Essix retainers, and expanders.',
    supportsTryIn: false,
    isBuiltIn: true,
    stages: [
      { key: 'CASE_PREPARATION', label: 'Case Preparation', phase: 'PRODUCTION', desc: 'Rx review & arch block-out' },
      { key: 'MODEL_SCAN_PREP', label: 'Model / Scan Preparation', phase: 'PRODUCTION', desc: 'Stone cast trimming or 3D model print' },
      { key: 'APPLIANCE_FABRICATION', label: 'Appliance Fabrication', phase: 'PRODUCTION', desc: 'Labial bow wire bending / acrylic cure or thermoforming' },
      { key: 'FINISHING_ADJUSTMENT', label: 'Finishing and Adjustment', phase: 'PRODUCTION', desc: 'Scalloping, gingival trim, & high-shine polish' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Retention fit, wire adaptation & clasp inspection' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Sanitized, packaged & awaiting pickup/courier' },
    ],
  },

  CROWNS_BRIDGES_DIGITAL: {
    id: 'CROWNS_BRIDGES_DIGITAL',
    name: 'Workflow B1 — Crowns & Bridges (Digital CAD/CAM)',
    shortName: 'Crowns & Bridges (CAD/CAM)',
    category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
    description: 'Digitally designed and milled/printed monolithic zirconia, lithium disilicate (e.max), and PMMA restorations.',
    supportsTryIn: false,
    isBuiltIn: true,
    stages: [
      { key: 'CASE_PREPARATION', label: 'Case Preparation', phase: 'PRODUCTION', desc: 'Margin marking & occlusion verification' },
      { key: 'CAD_DESIGN', label: 'CAD Design', phase: 'PRODUCTION', desc: 'Digital 3D anatomical crown/pontic modeling' },
      { key: 'CAM_MILLING_PRINT', label: 'CAM Milling / 3D Printing', phase: 'PRODUCTION', desc: '5-axis zirconia/ceramic milling or resin print' },
      { key: 'FINISHING_STAIN_GLAZE', label: 'Finishing / Staining / Glazing', phase: 'PRODUCTION', desc: 'Furnace sintering, characterization & glaze' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Marginal integrity, proximal contacts & shade QA' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Ready for clinic delivery' },
    ],
  },

  CROWNS_BRIDGES_CONVENTIONAL: {
    id: 'CROWNS_BRIDGES_CONVENTIONAL',
    name: 'Workflow B2 — Crowns & Bridges (Conventional)',
    shortName: 'Crowns & Bridges (Conventional)',
    category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
    description: 'Conventional lost-wax casting, pressed ceramics, and hand-layered PFM restorations without CAD/CAM.',
    supportsTryIn: true,
    isBuiltIn: true,
    stages: [
      { key: 'CASE_PREPARATION', label: 'Case Preparation', phase: 'PRODUCTION', desc: 'Impression disinfection & pouring' },
      { key: 'DIE_ARTICULATION', label: 'Die Trimming & Articulation', phase: 'PRODUCTION', desc: 'Pinned master cast & articulator mounting' },
      { key: 'WAXUP_CASTING', label: 'Wax-Up & Casting / Pressing', phase: 'PRODUCTION', desc: 'Coping wax pattern, investing & alloy casting/pressing' },
      { key: 'PORCELAIN_GLAZE', label: 'Porcelain Layering & Glaze', phase: 'PRODUCTION', desc: 'Opaque, dentin/enamel build-up & glazing' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Die seating, occlusion & Vita shade check' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Ready for clinic delivery' },
    ],
  },

  DENTURES: {
    id: 'DENTURES',
    name: 'Workflow C — Dentures (Complete / Partial / Flexible)',
    shortName: 'Dentures',
    category: APPLIANCE_CATEGORIES.DENTURES,
    description: 'Complete dentures, cast/acrylic removable partial dentures, and flexible polyamide prostheses with optional clinic wax try-in.',
    supportsTryIn: true,
    isBuiltIn: true,
    stages: [
      { key: 'CASE_PREPARATION', label: 'Case Preparation', phase: 'PRODUCTION', desc: 'Cast survey, path of insertion & bite block prep' },
      { key: 'MODEL_PREPARATION', label: 'Model Preparation', phase: 'PRODUCTION', desc: 'Master cast duplication & articulation' },
      { key: 'WAX_UP_SETUP', label: 'Wax-Up / Setup', phase: 'PRODUCTION', desc: ' Baseplate & prosthetic tooth arrangement in wax' },
      { key: 'TRIAL_CLINIC_APPROVAL', label: 'Trial / Clinic Approval', phase: 'PRODUCTION', desc: 'Chairside wax try-in verification (if required)', isTryInStage: true },
      { key: 'PROCESSING_FINISHING', label: 'Processing and Finishing', phase: 'PRODUCTION', desc: 'Flasking, acrylic/nylon injection, deflasking & festooning' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Border smoothness, occlusion & tissue adaptation QA' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Hydrated/packaged & ready for dispatch' },
    ],
  },

  REPAIRS_MODIFICATIONS: {
    id: 'REPAIRS_MODIFICATIONS',
    name: 'Workflow D — Repairs and Modifications',
    shortName: 'Repairs & Modifications',
    category: APPLIANCE_CATEGORIES.REPAIRS_MODIFICATIONS,
    description: 'Fractured denture repair, clasp/tooth addition, hard/soft laboratory reline, and appliance adjustments.',
    supportsTryIn: false,
    isBuiltIn: true,
    stages: [
      { key: 'ITEM_RECEIVED', label: 'Item Received', phase: 'PRODUCTION', desc: 'Ultrasonic disinfection & intake logging of existing appliance' },
      { key: 'ASSESSMENT', label: 'Assessment', phase: 'PRODUCTION', desc: 'Fracture line index / structural repair evaluation' },
      { key: 'REPAIR_MODIFICATION', label: 'Repair / Modification', phase: 'PRODUCTION', desc: 'Acrylic bonding, wire reinforcement, tooth/clasp addition, or reline' },
      { key: 'FINISHING', label: 'Finishing', phase: 'PRODUCTION', desc: 'Flash removal, contouring & pumice polish' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Structural integrity & fit verification on index cast' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Sanitized & ready for clinic return' },
    ],
  },

  OTHER_CUSTOM: {
    id: 'OTHER_CUSTOM',
    name: 'Workflow E — Other Appliances (Configurable)',
    shortName: 'Other Appliances',
    category: APPLIANCE_CATEGORIES.OTHER,
    description: 'Occlusal splints/nightguards, diagnostic wax-ups, surgical guides, bleaching trays, and custom appliances.',
    supportsTryIn: false,
    isBuiltIn: true,
    stages: [
      { key: 'CASE_PREPARATION', label: 'Case Preparation', phase: 'PRODUCTION', desc: 'Prescription & model/scan preparation' },
      { key: 'CUSTOM_FABRICATION', label: 'Appliance Fabrication', phase: 'PRODUCTION', desc: 'Service-specific fabrication step' },
      { key: 'FINISHING_POLISHING', label: 'Finishing & Conditioning', phase: 'PRODUCTION', desc: 'Occlusal adjustment & surface finishing' },
      { key: 'QUALITY_CHECK', label: 'Quality Check', phase: 'QUALITY_CHECK', desc: 'Final prescription & workmanship check' },
      { key: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch', phase: 'DISPATCH', desc: 'Ready for pickup or dispatch' },
    ],
  },
};

export const APPLIANCE_CATALOG_PRESETS = [
  {
    label: 'Hawley Orthodontic Retainer',
    category: APPLIANCE_CATEGORIES.ORTHO_RETAINERS,
    workflowId: 'ORTHO_RETAINERS',
    defaultMaterial: 'PMMA Orthodontic Acrylic + .028 SS Wire',
    defaultShade: 'Clear / Pink Acrylic',
    defaultInputType: 'PHYSICAL_IMPRESSION',
    retainerSubtype: 'HAWLEY',
  },
  {
    label: 'Clear Thermoformed Retainer (Essix)',
    category: APPLIANCE_CATEGORIES.ORTHO_RETAINERS,
    workflowId: 'ORTHO_RETAINERS',
    defaultMaterial: 'Thermoformed Clear PETG (1.0mm)',
    defaultShade: 'Clear / N/A',
    defaultInputType: 'DIGITAL_SCAN',
    retainerSubtype: 'CLEAR_ESSIX',
  },
  {
    label: 'Monolithic Zirconia Crown',
    category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
    workflowId: 'CROWNS_BRIDGES_DIGITAL',
    defaultMaterial: 'Multilayer Zirconia',
    defaultShade: 'A2',
    defaultInputType: 'DIGITAL_SCAN',
  },
  {
    label: 'Conventional PFM Crown / Bridge',
    category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
    workflowId: 'CROWNS_BRIDGES_CONVENTIONAL',
    defaultMaterial: 'Porcelain-Fused-to-Metal (Co-Cr / Ceramic)',
    defaultShade: 'A2',
    defaultInputType: 'PHYSICAL_IMPRESSION',
  },
  {
    label: 'Complete Denture (With Wax Try-In)',
    category: APPLIANCE_CATEGORIES.DENTURES,
    workflowId: 'DENTURES',
    defaultMaterial: 'High-Impact Heat-Cured Acrylic',
    defaultShade: 'A2',
    defaultInputType: 'STONE_MODEL',
    requiresTryIn: true,
  },
  {
    label: 'Flexible Partial Denture (Valplast)',
    category: APPLIANCE_CATEGORIES.DENTURES,
    workflowId: 'DENTURES',
    defaultMaterial: 'Flexible Polyamide (Valplast)',
    defaultShade: 'A2',
    defaultInputType: 'PHYSICAL_IMPRESSION',
    requiresTryIn: false,
  },
  {
    label: 'Denture Fracture Repair / Clasp Addition',
    category: APPLIANCE_CATEGORIES.REPAIRS_MODIFICATIONS,
    workflowId: 'REPAIRS_MODIFICATIONS',
    defaultMaterial: 'Autopolymerizing Repair Acrylic / Wrought Wire',
    defaultShade: 'Match Existing',
    defaultInputType: 'EXISTING_APPLIANCE',
  },
  {
    label: 'Hard/Soft Occlusal Nightguard',
    category: APPLIANCE_CATEGORIES.OTHER,
    workflowId: 'OTHER_CUSTOM',
    defaultMaterial: 'Dual-Laminate Hard/Soft Splint Material',
    defaultShade: 'Clear / N/A',
    defaultInputType: 'DIGITAL_SCAN',
  },
];

/**
 * Infers appliance category and default workflow template from applianceType text
 * when reconciling historical records that predate service-specific workflows.
 */
export function inferCategoryAndWorkflow(applianceType = '', material = '') {
  const text = `${applianceType} ${material}`.toLowerCase();

  if (text.includes('repair') || text.includes('reline') || text.includes('rebase') || text.includes('modification') || text.includes('adjustment')) {
    return {
      category: APPLIANCE_CATEGORIES.REPAIRS_MODIFICATIONS,
      workflowId: 'REPAIRS_MODIFICATIONS',
    };
  }
  if (text.includes('denture') || text.includes('valplast') || text.includes('rpd')) {
    return {
      category: APPLIANCE_CATEGORIES.DENTURES,
      workflowId: 'DENTURES',
    };
  }
  if (text.includes('retainer') || text.includes('hawley') || text.includes('essix') || text.includes('aligner') || text.includes('expander') || text.includes('ortho')) {
    return {
      category: APPLIANCE_CATEGORIES.ORTHO_RETAINERS,
      workflowId: 'ORTHO_RETAINERS',
    };
  }
  if (text.includes('pfm') || text.includes('porcelain-fused') || text.includes('conventional') || text.includes('cast metal')) {
    return {
      category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
      workflowId: 'CROWNS_BRIDGES_CONVENTIONAL',
    };
  }
  if (text.includes('crown') || text.includes('bridge') || text.includes('veneer') || text.includes('inlay') || text.includes('onlay') || text.includes('zirconia') || text.includes('e.max')) {
    return {
      category: APPLIANCE_CATEGORIES.CROWNS_BRIDGES,
      workflowId: 'CROWNS_BRIDGES_DIGITAL',
    };
  }
  return {
    category: APPLIANCE_CATEGORIES.OTHER,
    workflowId: 'OTHER_CUSTOM',
  };
}

/**
 * Resolves a workflow template from merged built-in + custom templates
 */
export function getWorkflowTemplate(workflowId, customTemplatesMap = {}) {
  const merged = { ...DEFAULT_WORKFLOW_TEMPLATES, ...customTemplatesMap };
  return merged[workflowId] || DEFAULT_WORKFLOW_TEMPLATES.OTHER_CUSTOM;
}

/**
 * Generates a privacy-safe case reference for overview tables & Kanban cards (Phase 4 & Phase 8)
 * Avoids unnecessarily exposing full patient names/contact PII in summary lists.
 */
export function formatPatientCaseRef(order) {
  if (!order) return 'CASE-UNKNOWN';
  if (order.caseReference) return order.caseReference;

  const rawName = (order.patientName || '').trim();
  const initials = rawName
    ? rawName
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, 3)
        .join('.') + '.'
    : 'PT';

  const idSuffix = String(order.patientId || order.id || '0000')
    .slice(-4)
    .toUpperCase();

  return `CASE-${idSuffix} (${initials})`;
}

/**
 * Formats a human-readable Laboratory Request ID while preserving the underlying Firestore document ID
 */
export function formatLabRequestCode(order) {
  if (!order?.id) return 'LAB-NEW';
  if (order.requestCode) return order.requestCode;
  return `LAB-${String(order.id).slice(0, 6).toUpperCase()}`;
}

/**
 * Formats tooth numbers and/or dental arch cleanly
 */
export function formatArchAndTeeth(order) {
  if (!order) return 'Not specified';
  const parts = [];
  if (order.arch && order.arch !== 'NOT_SPECIFIED' && DENTAL_ARCH_LABELS[order.arch]) {
    parts.push(DENTAL_ARCH_LABELS[order.arch]);
  }
  if (Array.isArray(order.toothNumbers) && order.toothNumbers.length > 0) {
    parts.push(`#${order.toothNumbers.join(', #')}`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'Standard Arch';
}

/**
 * Determines whether an active laboratory order is overdue
 */
export function isOrderOverdue(order) {
  if (!order) return false;
  if (order.status === LAB_ORDER_STATUS.COMPLETED || order.status === LAB_ORDER_STATUS.DECLINED) {
    return false;
  }
  const dueStr = order.estimatedCompletionDate || order.targetDeliveryDate;
  if (!dueStr) return false;

  const due = new Date(dueStr);
  if (isNaN(due.getTime())) return false;
  // Compare against end of the due date in local time
  const dueEnd = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  return Date.now() > dueEnd.getTime();
}

/**
 * Non-destructive reconciliation of legacy/historical Firestore `labOrders` documents (Phase 8).
 * Preserves existing IDs, timestamps, and historical DISPATCHED / COMPLETED cases without resetting them.
 */
export function reconcileLabOrder(rawOrder, customTemplatesMap = {}) {
  if (!rawOrder) return null;

  const inferred = inferCategoryAndWorkflow(rawOrder.applianceType, rawOrder.material);
  const category = rawOrder.category || inferred.category;
  const workflowId = rawOrder.workflowId || inferred.workflowId;
  const template = getWorkflowTemplate(workflowId, customTemplatesMap);
  const stages = Array.isArray(rawOrder.customStages) && rawOrder.customStages.length > 0
    ? rawOrder.customStages
    : template.stages;
  const prodOnlyStages = stages.filter((s) => s.phase === 'PRODUCTION');

  let normalizedStatus = rawOrder.status || LAB_ORDER_STATUS.PENDING_REVIEW;
  let productionStage = rawOrder.productionStage || null;
  let materialsStatus = rawOrder.materialsStatus || null;
  let dispatchSubStatus = rawOrder.dispatchSubStatus || null;

  // Reconcile historical / legacy status codes safely
  switch (rawOrder.status) {
    case 'ORDERED':
    case 'PENDING_REVIEW':
      normalizedStatus = LAB_ORDER_STATUS.PENDING_REVIEW;
      break;
    case 'REVISION_NEEDED':
    case 'CLARIFICATION_REQUESTED':
      normalizedStatus = LAB_ORDER_STATUS.CLARIFICATION_REQUESTED;
      break;
    case 'DECLINED':
      normalizedStatus = LAB_ORDER_STATUS.DECLINED;
      break;
    case 'RECEIVED':
      // Legacy 'RECEIVED' meant accepted into intake on old board
      normalizedStatus = LAB_ORDER_STATUS.ACCEPTED;
      materialsStatus = materialsStatus || MATERIALS_STATUS.READY_FOR_PRODUCTION;
      productionStage = productionStage || prodOnlyStages[0]?.key || stages[0]?.key;
      break;
    case 'ACCEPTED':
      normalizedStatus = LAB_ORDER_STATUS.ACCEPTED;
      materialsStatus = materialsStatus || MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'DESIGN':
      normalizedStatus = LAB_ORDER_STATUS.IN_PRODUCTION;
      productionStage = productionStage || prodOnlyStages[1]?.key || prodOnlyStages[0]?.key;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'MILLING':
      normalizedStatus = LAB_ORDER_STATUS.IN_PRODUCTION;
      productionStage = productionStage || prodOnlyStages[2]?.key || prodOnlyStages[0]?.key;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'GLAZING':
      normalizedStatus = LAB_ORDER_STATUS.IN_PRODUCTION;
      productionStage = productionStage || prodOnlyStages[prodOnlyStages.length - 1]?.key;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'IN_PROGRESS':
    case 'IN_PRODUCTION':
      normalizedStatus = LAB_ORDER_STATUS.IN_PRODUCTION;
      productionStage = productionStage || prodOnlyStages[0]?.key || stages[0]?.key;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'QA':
    case 'QUALITY_CHECK':
      normalizedStatus = LAB_ORDER_STATUS.QUALITY_CHECK;
      productionStage = 'QUALITY_CHECK';
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'READY':
    case 'READY_FOR_DISPATCH':
      normalizedStatus = LAB_ORDER_STATUS.READY_FOR_DISPATCH;
      productionStage = 'READY_FOR_DISPATCH';
      dispatchSubStatus = dispatchSubStatus || DISPATCH_SUB_STATUS.READY_FOR_PICKUP;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'DISPATCHED':
      // CRITICAL (Phase 8): Preserve historical DISPATCHED cases as DISPATCHED (never auto-complete or reset!)
      normalizedStatus = LAB_ORDER_STATUS.DISPATCHED;
      productionStage = 'READY_FOR_DISPATCH';
      dispatchSubStatus = dispatchSubStatus || DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT;
      materialsStatus = MATERIALS_STATUS.READY_FOR_PRODUCTION;
      break;
    case 'ISSUE_REPORTED':
      normalizedStatus = LAB_ORDER_STATUS.ISSUE_REPORTED;
      break;
    case 'DELIVERED':
    case 'COMPLETED':
      normalizedStatus = LAB_ORDER_STATUS.COMPLETED;
      productionStage = 'READY_FOR_DISPATCH';
      break;
    default:
      normalizedStatus = LAB_ORDER_STATUS.PENDING_REVIEW;
  }

  const estimatedCompletionDate =
    rawOrder.estimatedCompletionDate || rawOrder.targetDeliveryDate || '';

  return {
    ...rawOrder,
    rawStatus: rawOrder.status,
    status: normalizedStatus,
    category,
    workflowId,
    workflowName: template.name,
    workflowShortName: template.shortName,
    workflowStages: stages,
    productionStage,
    materialsStatus,
    dispatchSubStatus,
    estimatedCompletionDate,
    targetDeliveryDate: rawOrder.targetDeliveryDate || estimatedCompletionDate,
    clinicName: rawOrder.clinicName || 'SmileGuard Dental Clinic',
    caseReference: formatPatientCaseRef(rawOrder),
    requestCode: formatLabRequestCode(rawOrder),
    isOverdue: isOrderOverdue({
      ...rawOrder,
      status: normalizedStatus,
      estimatedCompletionDate,
    }),
  };
}

/**
 * Authoritative Role & State-Machine Guard (Phase 7 & Phase 9)
 * Enforces both WHO can execute a status transition and WHICH transitions are legal
 * so required statuses (such as Materials Ready, Quality Check, or Clinic Receipt) cannot be skipped.
 */
export function validateWorkflowTransition({
  currentOrder,
  targetStatus,
  userRole,
}) {
  if (!currentOrder) {
    return { allowed: false, reason: 'Order record does not exist.' };
  }

  const isClinicAuth = [ROLES.DENTIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(userRole);
  const isLabAuth = [ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(userRole);

  if (!isClinicAuth && !isLabAuth) {
    return { allowed: false, reason: 'Unauthorized role for laboratory operations.' };
  }

  const current = currentOrder.status;

  // Clinic-only transitions
  if (targetStatus === LAB_ORDER_STATUS.COMPLETED) {
    if (!isClinicAuth) {
      return {
        allowed: false,
        reason: 'Only authorized clinic personnel can confirm physical receipt to complete a request.',
      };
    }
    if (
      ![
        LAB_ORDER_STATUS.READY_FOR_DISPATCH,
        LAB_ORDER_STATUS.DISPATCHED,
      ].includes(current)
    ) {
      return {
        allowed: false,
        reason: 'Order must pass Quality Check and be Ready for Pickup or Dispatched before Clinic Receipt.',
      };
    }
    return { allowed: true };
  }

  if (targetStatus === LAB_ORDER_STATUS.ISSUE_REPORTED) {
    if (!isClinicAuth) {
      return {
        allowed: false,
        reason: 'Only authorized clinic personnel can raise a delivery or specification receipt issue.',
      };
    }
    if (
      ![
        LAB_ORDER_STATUS.READY_FOR_DISPATCH,
        LAB_ORDER_STATUS.DISPATCHED,
      ].includes(current)
    ) {
      return {
        allowed: false,
        reason: 'Delivery issues can only be reported on Ready or Dispatched appliances.',
      };
    }
    return { allowed: true };
  }

  // Clarification resubmission by Clinic
  if (
    current === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED &&
    targetStatus === LAB_ORDER_STATUS.PENDING_REVIEW
  ) {
    if (!isClinicAuth) {
      return {
        allowed: false,
        reason: 'Only the requesting clinic/dentist can submit clarification responses.',
      };
    }
    return { allowed: true };
  }

  // Laboratory-controlled transitions
  if (!isLabAuth) {
    return {
      allowed: false,
      reason: 'Only authorized laboratory personnel can update laboratory intake, production, QC, or dispatch statuses.',
    };
  }

  const validLabTransitions = {
    [LAB_ORDER_STATUS.PENDING_REVIEW]: [
      LAB_ORDER_STATUS.ACCEPTED,
      LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
      LAB_ORDER_STATUS.DECLINED,
    ],
    [LAB_ORDER_STATUS.CLARIFICATION_REQUESTED]: [
      LAB_ORDER_STATUS.ACCEPTED,
      LAB_ORDER_STATUS.DECLINED,
    ],
    [LAB_ORDER_STATUS.ACCEPTED]: [
      LAB_ORDER_STATUS.IN_PRODUCTION,
      LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
    ],
    [LAB_ORDER_STATUS.IN_PRODUCTION]: [
      LAB_ORDER_STATUS.IN_PRODUCTION,
      LAB_ORDER_STATUS.QUALITY_CHECK,
    ],
    [LAB_ORDER_STATUS.QUALITY_CHECK]: [
      LAB_ORDER_STATUS.READY_FOR_DISPATCH,
      LAB_ORDER_STATUS.IN_PRODUCTION, // QC Failure return to fabrication
    ],
    [LAB_ORDER_STATUS.READY_FOR_DISPATCH]: [
      LAB_ORDER_STATUS.DISPATCHED,
      LAB_ORDER_STATUS.QUALITY_CHECK,
    ],
    [LAB_ORDER_STATUS.DISPATCHED]: [
      LAB_ORDER_STATUS.DISPATCHED,
    ],
    [LAB_ORDER_STATUS.ISSUE_REPORTED]: [
      LAB_ORDER_STATUS.IN_PRODUCTION, // Remake / adjustment in lab
      LAB_ORDER_STATUS.QUALITY_CHECK,
      LAB_ORDER_STATUS.DISPATCHED, // Replacement / corrected item dispatched
    ],
  };

  const allowedNext = validLabTransitions[current] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid workflow transition from ${current} to ${targetStatus}. Required stages cannot be skipped.`,
    };
  }

  // Material readiness check before starting production
  if (
    current === LAB_ORDER_STATUS.ACCEPTED &&
    targetStatus === LAB_ORDER_STATUS.IN_PRODUCTION &&
    currentOrder.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS
  ) {
    return {
      allowed: false,
      reason: 'Cannot start production while Awaiting Materials. Confirm material receipt first.',
    };
  }

  // Prevent moving to Quality Check while awaiting Clinic Try-In approval
  if (
    current === LAB_ORDER_STATUS.IN_PRODUCTION &&
    targetStatus === LAB_ORDER_STATUS.QUALITY_CHECK &&
    currentOrder.tryInStatus === 'SENT_TO_CLINIC'
  ) {
    return {
      allowed: false,
      reason: 'Case is currently awaiting Clinic Try-In approval before final processing and Quality Check.',
    };
  }

  return { allowed: true };
}
