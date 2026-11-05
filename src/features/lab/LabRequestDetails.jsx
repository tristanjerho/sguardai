import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  User,
  Stethoscope,
  Calendar,
  Truck,
  ShieldCheck,
  MessageSquare,
  Send,
  Lock,
  Printer,
  ExternalLink,
  Image as ImageIcon,
  Wrench,
  PackageCheck,
  XCircle,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { authService } from '../../services/authService';
import { imageService } from '../../services/imageService';
import { isCloudinaryConfigured } from '../../config/cloudinary';
import { ROLES } from '../../lib/roles';
import {
  LAB_ORDER_STATUS,
  STATUS_DISPLAY_LABELS,
  MATERIALS_STATUS,
  MATERIALS_DISPLAY_LABELS,
  DISPATCH_SUB_STATUS,
  DISPATCH_SUB_LABELS,
  APPLIANCE_CATEGORY_LABELS,
  INPUT_SUBMISSION_TYPES,
  formatArchAndTeeth,
} from '../../lib/labWorkflows';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export function LabRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  const isClinicPortal = location.pathname.startsWith('/clinic');
  const isLabAuthorized = [ROLES.LAB_TECH, ROLES.ADMIN, ROLES.SUPERADMIN].includes(user?.role);
  const isClinicAuthorized = [ROLES.DENTIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(user?.role);

  const [order, setOrder] = useState(null);
  const [workflowsMap, setWorkflowsMap] = useState({});
  const [labStaff, setLabStaff] = useState([]);
  const [internalNotes, setInternalNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  // Communication & Internal Note composers
  const [commMessage, setCommMessage] = useState('');
  const [isSendingComm, setIsSendingComm] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState('');
  const [isSavingInternal, setIsSavingInternal] = useState(false);

  // Action Modals
  const [activeModal, setActiveModal] = useState(null);
  // 'ACCEPT' | 'CLARIFY' | 'DECLINE' | 'RESPOND_CLARIFY' | 'MATERIALS' | 'START_PROD' | 'STAGE' | 'EDIT_PROD' | 'TRY_IN_RESPONSE' | 'QC' | 'DISPATCH' | 'CLINIC_RECEIPT' | 'REPORT_ISSUE' | 'RESOLVE_ISSUE'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Form States
  const [acceptMaterialsReady, setAcceptMaterialsReady] = useState(true);
  const [acceptWorkflowId, setAcceptWorkflowId] = useState('');
  const [acceptEstDate, setAcceptEstDate] = useState('');
  const [acceptTech, setAcceptTech] = useState('');
  const [acceptCost, setAcceptCost] = useState('');
  const [acceptNotes, setAcceptNotes] = useState('');

  const [reasonText, setReasonText] = useState('');
  const [materialCondition, setMaterialCondition] = useState('Intact & verified against Rx');
  const [selectedStageKey, setSelectedStageKey] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [sendForTryIn, setSendForTryIn] = useState(false);
  const [tryInApproved, setTryInApproved] = useState(true);

  const [editTech, setEditTech] = useState('');
  const [editEstDate, setEditEstDate] = useState('');
  const [attachmentUrlInput, setAttachmentUrlInput] = useState('');
  const [attachmentTitleInput, setAttachmentTitleInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Quality Check state
  const [qcPassed, setQcPassed] = useState(true);
  const [qcChecklist, setQcChecklist] = useState({
    applianceVerified: true,
    materialVerified: true,
    toothOrArchVerified: true,
    workmanshipVerified: true,
    prescriptionMatched: true,
  });
  const [qcNotes, setQcNotes] = useState('');
  const [qcReturnStage, setQcReturnStage] = useState('');

  // Dispatch state
  const [dispatchSub, setDispatchSub] = useState(DISPATCH_SUB_STATUS.IN_TRANSIT);
  const [deliveryMethod, setDeliveryMethod] = useState('In-House Clinic Messenger');
  const [courierRef, setCourierRef] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Clinic Receipt & Issue state
  const [receiptStaff, setReceiptStaff] = useState('');
  const [receiptCondition, setReceiptCondition] = useState('Good / Intact — Matches Prescription');
  const [receiptRemarks, setReceiptRemarks] = useState('');
  const [issueType, setIssueType] = useState('Incorrect Specifications / Fit');
  const [issueDesc, setIssueDesc] = useState('');
  const [resolveAction, setResolveAction] = useState('RETURN_TO_PRODUCTION');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setAccessError('');

    const unsubTemplates = laboratoryService.subscribeWorkflowTemplates((map) => {
      setWorkflowsMap(map);
    });

    const unsubOrder = laboratoryService.subscribeById(
      id,
      user,
      (liveOrder) => {
        setOrder(liveOrder);
        setLoading(false);
      },
      (err) => {
        setAccessError(err.message || 'Unable to load laboratory request.');
        setLoading(false);
      }
    );

    const unsubNotes = laboratoryService.subscribeInternalNotes(
      id,
      user?.role,
      (notes) => setInternalNotes(notes)
    );

    const unsubUsers = authService.subscribeToUsers((allUsers) => {
      setLabStaff(allUsers.filter((u) => u.role === ROLES.LAB_TECH && !u.deactivated));
    });

    return () => {
      unsubTemplates();
      unsubOrder();
      unsubNotes();
      unsubUsers();
    };
  }, [id, user?.id, user?.role]);

  // Dynamic applicable timeline milestones for this specific order (Phase 5)
  const applicableMilestones = useMemo(() => {
    if (!order) return [];
    const steps = [
      { key: 'SUBMITTED', label: 'Submitted', reached: true },
      {
        key: 'REVIEWED',
        label: 'Reviewed',
        reached: order.status !== LAB_ORDER_STATUS.PENDING_REVIEW,
      },
    ];

    if (order.status === LAB_ORDER_STATUS.DECLINED) {
      steps.push({ key: 'DECLINED', label: 'Declined', reached: true, isAlert: true });
      return steps;
    }

    const postAcceptStatuses = [
      LAB_ORDER_STATUS.ACCEPTED,
      LAB_ORDER_STATUS.IN_PRODUCTION,
      LAB_ORDER_STATUS.QUALITY_CHECK,
      LAB_ORDER_STATUS.READY_FOR_DISPATCH,
      LAB_ORDER_STATUS.DISPATCHED,
      LAB_ORDER_STATUS.ISSUE_REPORTED,
      LAB_ORDER_STATUS.COMPLETED,
    ];
    const isAcceptedOrBeyond = postAcceptStatuses.includes(order.status);

    steps.push({
      key: 'ACCEPTED',
      label: 'Accepted',
      reached: isAcceptedOrBeyond,
    });

    steps.push({
      key: 'MATERIALS',
      label: order.requiresPhysicalMaterials
        ? 'Materials Received'
        : 'Ready for Production',
      reached:
        isAcceptedOrBeyond &&
        order.materialsStatus === MATERIALS_STATUS.READY_FOR_PRODUCTION,
    });

    const prodStatuses = [
      LAB_ORDER_STATUS.IN_PRODUCTION,
      LAB_ORDER_STATUS.QUALITY_CHECK,
      LAB_ORDER_STATUS.READY_FOR_DISPATCH,
      LAB_ORDER_STATUS.DISPATCHED,
      LAB_ORDER_STATUS.ISSUE_REPORTED,
      LAB_ORDER_STATUS.COMPLETED,
    ];
    steps.push({
      key: 'IN_PRODUCTION',
      label: 'In Production',
      reached: prodStatuses.includes(order.status),
    });

    const qcStatuses = [
      LAB_ORDER_STATUS.QUALITY_CHECK,
      LAB_ORDER_STATUS.READY_FOR_DISPATCH,
      LAB_ORDER_STATUS.DISPATCHED,
      LAB_ORDER_STATUS.ISSUE_REPORTED,
      LAB_ORDER_STATUS.COMPLETED,
    ];
    steps.push({
      key: 'QUALITY_CHECK',
      label: 'Quality Check',
      reached: qcStatuses.includes(order.status),
    });

    const readyStatuses = [
      LAB_ORDER_STATUS.READY_FOR_DISPATCH,
      LAB_ORDER_STATUS.DISPATCHED,
      LAB_ORDER_STATUS.ISSUE_REPORTED,
      LAB_ORDER_STATUS.COMPLETED,
    ];
    steps.push({
      key: 'READY_DISPATCHED',
      label: 'Ready / Dispatched',
      reached: readyStatuses.includes(order.status),
    });

    if (order.status === LAB_ORDER_STATUS.ISSUE_REPORTED || (order.issueHistory || []).length > 0) {
      steps.push({
        key: 'ISSUE',
        label: 'Delivery Issue',
        reached: true,
        isAlert: order.status === LAB_ORDER_STATUS.ISSUE_REPORTED,
      });
    }

    steps.push({
      key: 'RECEIVED_BY_CLINIC',
      label: 'Received by Clinic',
      reached: order.status === LAB_ORDER_STATUS.COMPLETED,
    });

    return steps;
  }, [order]);

  const productionOnlyStages = useMemo(() => {
    return (order?.workflowStages || []).filter((s) => s.phase === 'PRODUCTION');
  }, [order]);

  // Modal openers
  const openAccept = () => {
    const fallbackDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    setAcceptMaterialsReady(!order.requiresPhysicalMaterials);
    setAcceptWorkflowId(order.workflowId);
    setAcceptEstDate(order.estimatedCompletionDate || fallbackDate);
    setAcceptTech(order.assignedTech || user?.fullName || labStaff[0]?.fullName || '');
    setAcceptCost(order.cost || '');
    setAcceptNotes(order.labNotes || '');
    setActiveModal('ACCEPT');
  };

  const openStartProd = () => {
    const fallbackDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    setAcceptWorkflowId(order.workflowId);
    setAcceptTech(order.assignedTech || user?.fullName || labStaff[0]?.fullName || '');
    setAcceptEstDate(order.estimatedCompletionDate || fallbackDate);
    setStageNote('');
    setActiveModal('START_PROD');
  };

  const openAdvanceStage = () => {
    const stages = order.workflowStages || [];
    const currIdx = stages.findIndex((s) => s.key === order.productionStage);
    const nextStage =
      currIdx !== -1 && stages[currIdx + 1] && stages[currIdx + 1].phase !== 'DISPATCH'
        ? stages[currIdx + 1]
        : stages[0];
    setSelectedStageKey(nextStage?.key || '');
    setStageNote('');
    setSendForTryIn(Boolean(nextStage?.isTryInStage));
    setActiveModal('STAGE');
  };

  const openQualityCheck = () => {
    setQcPassed(true);
    setQcChecklist({
      applianceVerified: true,
      materialVerified: true,
      toothOrArchVerified: true,
      workmanshipVerified: true,
      prescriptionMatched: true,
    });
    setQcNotes('');
    setQcReturnStage(productionOnlyStages[productionOnlyStages.length - 1]?.key || '');
    setActiveModal('QC');
  };

  const openDispatchModal = () => {
    setDispatchSub(
      order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH
        ? DISPATCH_SUB_STATUS.IN_TRANSIT
        : DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT
    );
    setDeliveryMethod(order.dispatchDetails?.deliveryMethod || 'In-House Clinic Messenger');
    setCourierRef(order.dispatchDetails?.courierReference || '');
    setDispatchNotes('');
    setActiveModal('DISPATCH');
  };

  const openClinicReceipt = () => {
    setReceiptStaff(user?.fullName || user?.email || 'Clinic Staff');
    setReceiptCondition('Good / Intact — Matches Prescription');
    setReceiptRemarks('');
    setActiveModal('CLINIC_RECEIPT');
  };

  // Action Handlers
  const handleAccept = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.acceptOrder(
        order.id,
        {
          materialsAvailable: acceptMaterialsReady,
          workflowId: acceptWorkflowId,
          estimatedCompletionDate: acceptEstDate,
          assignedTech: acceptTech,
          cost: acceptCost,
          labNotes: acceptNotes,
        },
        user
      );
      toast.success('Laboratory request accepted.');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to accept request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClarifyOrDecline = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (activeModal === 'CLARIFY') {
        await laboratoryService.requestClarification(order.id, reasonText, user);
        toast.info('Clarification request sent to clinic.');
      } else if (activeModal === 'DECLINE') {
        await laboratoryService.declineRequest(order.id, reasonText, user);
        toast.info('Laboratory request declined.');
      } else if (activeModal === 'RESPOND_CLARIFY') {
        await laboratoryService.respondToClarification(
          order.id,
          { responseMessage: reasonText, notes: `${order.notes ? order.notes + '\n' : ''}[Clarification]: ${reasonText}` },
          user
        );
        toast.success('Clarification submitted back to Laboratory.');
      }
      setReasonText('');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMaterials = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.confirmMaterialsReceived(
        order.id,
        { conditionNote: materialCondition },
        user
      );
      toast.success('Physical materials confirmed — Ready for Production!');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm materials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartProduction = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.startProduction(
        order.id,
        {
          workflowId: acceptWorkflowId,
          assignedTech: acceptTech,
          estimatedCompletionDate: acceptEstDate,
          note: stageNote,
        },
        user
      );
      toast.success('Fabrication started!');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Could not start production.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStageUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.updateProductionStage(
        order.id,
        {
          stageKey: selectedStageKey,
          progressNote: stageNote,
          sendForClinicTryIn: sendForTryIn,
        },
        user
      );
      toast.success('Production stage updated.');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update production stage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryInResponse = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.respondToClinicTryIn(
        order.id,
        { approved: tryInApproved, dentistNotes: reasonText },
        user
      );
      toast.success(
        tryInApproved
          ? 'Try-in approved! Laboratory notified to resume final processing.'
          : 'Try-in feedback sent to laboratory.'
      );
      setReasonText('');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to record try-in evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProdDetails = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.updateProductionDetails(
        order.id,
        {
          assignedTech: editTech,
          estimatedCompletionDate: editEstDate,
          newLabAttachment: attachmentUrlInput.trim()
            ? { url: attachmentUrlInput.trim(), title: attachmentTitleInput.trim() || 'Fabrication Photo' }
            : null,
        },
        user
      );
      toast.success('Production details updated.');
      setAttachmentUrlInput('');
      setAttachmentTitleInput('');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save production details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploadingFile(true);
    try {
      const uploaded = await imageService.uploadDentalImage(file, {
        patientId: order.patientId || 'lab',
        type: 'INTRAORAL',
        uploadedBy: user?.id || user?.uid,
        notes: `Lab Fabrication Image for ${order.requestCode}`,
      });
      setAttachmentUrlInput(uploaded.secureUrl);
      setAttachmentTitleInput(file.name);
      toast.success('Image uploaded! Click Save Changes to attach to request.');
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitQc = async (e) => {
    e.preventDefault();
    if (qcPassed) {
      const allChecked = Object.values(qcChecklist).every(Boolean);
      if (!allChecked) {
        toast.error('All 5 Quality Check verification items must be confirmed to pass QC.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await laboratoryService.submitQualityCheck(
        order.id,
        {
          passed: qcPassed,
          checklist: qcChecklist,
          notes: qcNotes,
          returnToStageKey: qcReturnStage,
        },
        user
      );
      toast.success(
        qcPassed
          ? 'Quality Check passed — Appliance marked Ready for Pickup / Dispatch!'
          : 'Quality Check failure documented — Case returned to fabrication.'
      );
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to record Quality Check.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatchUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.updateDispatchStatus(
        order.id,
        {
          subStatus: dispatchSub,
          deliveryMethod,
          courierReference: courierRef,
          notes: dispatchNotes,
        },
        user
      );
      toast.success('Pickup / Dispatch status recorded and clinic notified.');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update dispatch details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClinicReceipt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.confirmClinicReceipt(
        order.id,
        {
          receivedBy: receiptStaff,
          condition: receiptCondition,
          remarks: receiptRemarks,
        },
        user
      );
      toast.success('Physical receipt confirmed — Laboratory Request marked Completed!');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm clinic receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.reportClinicIssue(
        order.id,
        { issueType, description: issueDesc },
        user
      );
      toast.info('Issue reported to the laboratory. Completion blocked until resolved.');
      setIssueDesc('');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to report issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveIssue = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await laboratoryService.resolveReportedIssue(
        order.id,
        {
          action: resolveAction,
          targetStageKey: qcReturnStage || productionOnlyStages[0]?.key,
          resolutionNotes: reasonText,
          courierReference: courierRef,
        },
        user
      );
      toast.success('Issue resolution recorded.');
      setReasonText('');
      setActiveModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to resolve issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCommunication = async (e) => {
    e.preventDefault();
    if (!commMessage.trim()) return;
    setIsSendingComm(true);
    try {
      await laboratoryService.addCommunication(
        order.id,
        { message: commMessage.trim() },
        user
      );
      setCommMessage('');
      toast.success('Message logged.');
    } catch (err) {
      toast.error(err.message || 'Failed to send message.');
    } finally {
      setIsSendingComm(false);
    }
  };

  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;
    setIsSavingInternal(true);
    try {
      await laboratoryService.addInternalNote(order.id, internalNoteText.trim(), user);
      setInternalNoteText('');
      toast.success('Internal technician note saved.');
    } catch (err) {
      toast.error(err.message || 'Failed to save internal note.');
    } finally {
      setIsSavingInternal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" className="h-28" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton variant="rectangular" className="h-80" />
          <Skeleton variant="rectangular" className="h-80" />
        </div>
      </div>
    );
  }

  if (accessError || !order) {
    return (
      <EmptyState
        title="Laboratory Request Unavailable"
        description={accessError || 'The requested laboratory work order could not be found.'}
        icon={AlertTriangle}
        actionLabel="Go Back"
        onAction={() => navigate(isClinicPortal ? '/clinic/lab-orders' : '/lab')}
      />
    );
  }

  const inputTypeLabel =
    INPUT_SUBMISSION_TYPES.find((i) => i.value === order.inputType)?.label ||
    order.inputType ||
    'Standard Prescription';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Print */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={ArrowLeft}
            onClick={() => navigate(isClinicPortal ? '/clinic/lab-orders' : '/lab')}
          >
            {isClinicPortal ? 'Back to Clinic Lab Orders' : 'Back to Order Intake'}
          </Button>
          {!isClinicPortal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/lab/board')}
            >
              Open Production Board
            </Button>
          )}
        </div>

        <Button variant="outline" size="sm" leftIcon={Printer} onClick={() => window.print()}>
          Print Prescription Slip
        </Button>
      </div>

      {/* Hero Status & Contextual Workflow Controls Banner */}
      <Card className="p-6 border-l-4 border-l-teal-500 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-900 text-teal-300 dark:bg-teal-950 dark:border dark:border-teal-700">
                {order.requestCode}
              </span>
              <Badge status={order.status} size="sm" showDot>
                {STATUS_DISPLAY_LABELS[order.status] || order.status}
              </Badge>

              {order.status === LAB_ORDER_STATUS.ACCEPTED && order.materialsStatus && (
                <Badge status={order.materialsStatus} size="sm" showDot>
                  {MATERIALS_DISPLAY_LABELS[order.materialsStatus]}
                </Badge>
              )}

              {(order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH ||
                order.status === LAB_ORDER_STATUS.DISPATCHED) &&
                order.dispatchSubStatus && (
                  <Badge status={order.dispatchSubStatus} size="sm">
                    {DISPATCH_SUB_LABELS[order.dispatchSubStatus] || order.dispatchSubStatus}
                  </Badge>
                )}

              {order.tryInStatus === 'SENT_TO_CLINIC' && (
                <Badge variant="warning" size="sm" showDot>
                  Wax Try-In at Clinic
                </Badge>
              )}

              {order.priority === 'RUSH' && (
                <Badge variant="danger" size="sm">
                  RUSH PRIORITY
                </Badge>
              )}

              {order.isOverdue && (
                <Badge variant="danger" size="sm">
                  OVERDUE
                </Badge>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ink-primary">
              {order.applianceType}
            </h2>
            <p className="text-xs text-ink-secondary">
              {order.clinicName} • Dr. {order.dentistName} • Case Ref:{' '}
              <strong className="font-mono text-ink-primary">{order.caseReference}</strong>
            </p>
          </div>

          {/* Role-Gated Primary Workflow Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. PENDING REVIEW (Lab Actions) */}
            {isLabAuthorized && order.status === LAB_ORDER_STATUS.PENDING_REVIEW && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('CLARIFY');
                  }}
                >
                  Request Clarification
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('DECLINE');
                  }}
                >
                  Decline Request
                </Button>
                <Button variant="primary" size="sm" leftIcon={CheckCircle2} onClick={openAccept}>
                  Accept Request
                </Button>
              </>
            )}

            {/* 2. CLARIFICATION REQUESTED (Clinic Action) */}
            {isClinicAuthorized && order.status === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={RotateCcw}
                onClick={() => {
                  setReasonText('');
                  setActiveModal('RESPOND_CLARIFY');
                }}
              >
                Provide Clarification &amp; Resubmit
              </Button>
            )}

            {/* 3. ACCEPTED: Materials Confirmation & Start Production (Lab Actions) */}
            {isLabAuthorized && order.status === LAB_ORDER_STATUS.ACCEPTED && (
              <>
                {order.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={PackageCheck}
                    onClick={() => setActiveModal('MATERIALS')}
                  >
                    Confirm Material Receipt
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Wrench}
                    onClick={openStartProd}
                  >
                    Start Production
                  </Button>
                )}
              </>
            )}

            {/* 4. IN PRODUCTION (Lab Stage Updates + Clinic Try-In Approval) */}
            {isLabAuthorized && order.status === LAB_ORDER_STATUS.IN_PRODUCTION && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditTech(order.assignedTech || '');
                    setEditEstDate(order.estimatedCompletionDate || '');
                    setActiveModal('EDIT_PROD');
                  }}
                >
                  Update Tech / Due Date
                </Button>
                <Button variant="primary" size="sm" onClick={openAdvanceStage}>
                  Update Fabrication Stage
                </Button>
              </>
            )}

            {isClinicAuthorized &&
              order.status === LAB_ORDER_STATUS.IN_PRODUCTION &&
              order.tryInStatus === 'SENT_TO_CLINIC' && (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    setTryInApproved(true);
                    setReasonText('');
                    setActiveModal('TRY_IN_RESPONSE');
                  }}
                >
                  Record Clinic Try-In Decision
                </Button>
              )}

            {/* 5. QUALITY CHECK (Lab Action) */}
            {isLabAuthorized && order.status === LAB_ORDER_STATUS.QUALITY_CHECK && (
              <Button variant="primary" size="sm" leftIcon={ShieldCheck} onClick={openQualityCheck}>
                Perform Quality Check
              </Button>
            )}

            {/* 6. READY FOR DISPATCH / DISPATCHED */}
            {isLabAuthorized &&
              (order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH ||
                order.status === LAB_ORDER_STATUS.DISPATCHED) && (
                <Button variant="secondary" size="sm" leftIcon={Truck} onClick={openDispatchModal}>
                  {order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH
                    ? 'Record Dispatch / Pickup'
                    : 'Update Transit Reference'}
                </Button>
              )}

            {isClinicAuthorized &&
              (order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH ||
                order.status === LAB_ORDER_STATUS.DISPATCHED) && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={AlertTriangle}
                    onClick={() => {
                      setIssueDesc('');
                      setActiveModal('REPORT_ISSUE');
                    }}
                  >
                    Report Issue
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={CheckCircle2}
                    onClick={openClinicReceipt}
                  >
                    Confirm Clinic Receipt
                  </Button>
                </>
              )}

            {/* 7. ISSUE REPORTED (Lab Resolution) */}
            {isLabAuthorized && order.status === LAB_ORDER_STATUS.ISSUE_REPORTED && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setReasonText('');
                  setQcReturnStage(productionOnlyStages[0]?.key || '');
                  setActiveModal('RESOLVE_ISSUE');
                }}
              >
                Resolve Reported Issue
              </Button>
            )}
          </div>
        </div>

        {/* Alert Callouts for Clarification, Decline, or Delivery Issue */}
        {order.status === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
            <strong className="block uppercase text-[10px] tracking-wider mb-0.5">
              Clarification Requested by Laboratory:
            </strong>
            &ldquo;{order.revisionReason || 'Additional clinical specification requested.'}&rdquo;
          </div>
        )}

        {order.status === LAB_ORDER_STATUS.DECLINED && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200">
            <strong className="block uppercase text-[10px] tracking-wider mb-0.5">
              Declined by {order.declinedBy || 'Laboratory'}:
            </strong>
            &ldquo;{order.declineReason}&rdquo;
          </div>
        )}

        {order.status === LAB_ORDER_STATUS.ISSUE_REPORTED && order.issueReport && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200">
            <strong className="block uppercase text-[10px] tracking-wider mb-0.5">
              Active Clinic Receipt Issue ({order.issueReport.issueType}) — Reported by {order.issueReport.reportedBy}:
            </strong>
            &ldquo;{order.issueReport.description}&rdquo;
          </div>
        )}

        {/* Applicable Request Lifecycle Stepper */}
        <div className="pt-2 border-t border-surface-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2.5">
            Request Lifecycle Progress
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {applicableMilestones.map((m) => (
              <div
                key={m.key}
                className={`p-2 rounded-xl border text-center transition-all ${
                  m.isAlert
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                    : m.reached
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-800 dark:text-teal-200'
                    : 'bg-surface-subtle border-surface-border text-ink-muted'
                }`}
              >
                <p className="text-[11px] font-bold truncate">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Main 2-Column Grid: Prescription Details + Production Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: PRESCRIPTION DETAILS */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Prescription Details</CardTitle>
            </div>
            <span className="text-xs font-mono text-ink-muted">ID: {order.id}</span>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
              <div>
                <p className="text-ink-muted">Request ID</p>
                <p className="font-mono font-bold text-ink-primary">{order.requestCode}</p>
              </div>
              <div>
                <p className="text-ink-muted">Requesting Clinic</p>
                <p className="font-bold text-ink-primary">{order.clinicName}</p>
              </div>
              <div>
                <p className="text-ink-muted">Assigned Dentist</p>
                <p className="font-bold text-ink-primary">Dr. {order.dentistName}</p>
              </div>
              <div>
                <p className="text-ink-muted">Patient Case Reference</p>
                <p className="font-mono font-bold text-teal-700 dark:text-teal-300">
                  {order.caseReference}
                  {isClinicAuthorized && order.patientName ? ` — ${order.patientName}` : ''}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Appliance / Service Type</p>
                <p className="font-bold text-ink-primary">{order.applianceType}</p>
                <p className="text-[11px] text-ink-muted">
                  {APPLIANCE_CATEGORY_LABELS[order.category] || order.category}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Material &amp; Shade Specs</p>
                <p className="font-bold text-ink-primary">
                  {order.material || 'Standard'} {order.shade ? `• Shade ${order.shade}` : ''}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Tooth Number / Dental Arch</p>
                <p className="font-mono font-bold text-ink-primary">{formatArchAndTeeth(order)}</p>
              </div>
              <div>
                <p className="text-ink-muted">Requested Due Date</p>
                <p className="font-bold text-ink-primary">
                  {formatDate(order.targetDeliveryDate)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-ink-muted">Case Input Method</p>
                <p className="font-semibold text-ink-primary">{inputTypeLabel}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Dentist Special Instructions
              </p>
              <p className="text-ink-primary whitespace-pre-wrap">
                {order.notes || 'No additional special instructions recorded.'}
              </p>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Prescription &amp; Fabrication Attachments
              </p>

              {!order.attachmentUrl && !order.cadFileUrl && !(order.labAttachments || []).length ? (
                <p className="text-ink-muted italic">No digital scan or image files attached.</p>
              ) : (
                <div className="space-y-2.5">
                  {order.attachmentUrl && (
                    <a
                      href={order.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl overflow-hidden border border-surface-border bg-slate-950"
                    >
                      <img
                        src={order.attachmentUrl}
                        alt={order.attachmentTitle || 'Clinical Attachment'}
                        className="w-full max-h-48 object-contain"
                      />
                      <div className="px-3 py-1.5 bg-surface-card text-[11px] font-semibold text-ink-primary flex items-center justify-between">
                        <span>{order.attachmentTitle || 'Clinic Diagnostic Scan'}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-teal-500" />
                      </div>
                    </a>
                  )}

                  {order.cadFileUrl && (
                    <a
                      href={order.cadFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Digital 3D Scan / STL File
                    </a>
                  )}

                  {(order.labAttachments || []).map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-subtle border border-surface-border hover:border-teal-500 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-semibold text-ink-primary">
                        <ImageIcon className="w-4 h-4 text-teal-500" />
                        {att.title} <span className="text-ink-muted font-normal">({att.uploadedBy})</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-ink-muted" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: PRODUCTION, QC, DISPATCH & CLINIC RECEIPT DETAILS */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <CardTitle>Production &amp; Quality Details</CardTitle>
            </div>
            <Badge variant="primary" size="sm">
              {order.workflowShortName}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
              <div>
                <p className="text-ink-muted">Receiving Laboratory</p>
                <p className="font-bold text-ink-primary">{order.vendor}</p>
              </div>
              <div>
                <p className="text-ink-muted">Assigned Technician</p>
                <p className="font-bold text-teal-700 dark:text-teal-300">
                  {order.assignedTech || 'Pending Assignment'}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Workflow Template</p>
                <p className="font-bold text-ink-primary">{order.workflowName}</p>
              </div>
              <div>
                <p className="text-ink-muted">Estimated Completion Date</p>
                <p className="font-bold text-ink-primary">
                  {formatDate(order.estimatedCompletionDate)}
                </p>
              </div>
            </div>

            {/* Service-Specific Stages List */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Service-Specific Production Stages ({order.workflowShortName})
              </p>
              <div className="space-y-1.5">
                {(order.workflowStages || []).map((stg, idx) => {
                  const currIdx = (order.workflowStages || []).findIndex(
                    (s) => s.key === order.productionStage
                  );
                  const isCurrent =
                    order.productionStage === stg.key &&
                    order.status !== LAB_ORDER_STATUS.COMPLETED;
                  const isCompletedStep =
                    order.status === LAB_ORDER_STATUS.COMPLETED ||
                    (currIdx !== -1 && idx < currIdx);

                  return (
                    <div
                      key={stg.key}
                      className={`px-3.5 py-2 rounded-xl border flex items-center justify-between ${
                        isCurrent
                          ? 'bg-teal-500/10 border-teal-500 text-teal-900 dark:text-teal-200 font-bold'
                          : isCompletedStep
                          ? 'bg-emerald-500/5 border-emerald-500/30 text-ink-primary'
                          : 'bg-surface-subtle border-surface-border text-ink-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px]">{idx + 1}.</span>
                        <span>{stg.label}</span>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-teal-600 dark:text-teal-300">
                          Current Stage
                        </span>
                      )}
                      {isCompletedStep && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality Check Result Summary */}
            {order.qcResult && (
              <div
                className={`p-3.5 rounded-2xl border space-y-1 ${
                  order.qcResult.passed
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink-primary">
                    Quality Check: {order.qcResult.passed ? 'PASSED' : 'RETURNED TO PRODUCTION'}
                  </p>
                  <span className="text-[11px] text-ink-muted">
                    {order.qcResult.checkedBy} • {formatDateTime(order.qcResult.checkedAt)}
                  </span>
                </div>
                {order.qcResult.notes && <p className="text-ink-secondary">{order.qcResult.notes}</p>}
              </div>
            )}

            {/* Dispatch & Clinic Receipt Summary */}
            {order.dispatchDetails && (
              <div className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border space-y-1">
                <p className="font-bold text-ink-primary">
                  Pickup / Dispatch Record ({DISPATCH_SUB_LABELS[order.dispatchSubStatus] || order.dispatchSubStatus})
                </p>
                <p className="text-ink-secondary">
                  Method: <strong>{order.dispatchDetails.deliveryMethod || 'Standard'}</strong>
                  {order.dispatchDetails.courierReference
                    ? ` • Ref: ${order.dispatchDetails.courierReference}`
                    : ''}
                </p>
                {order.dispatchDetails.dispatchDate && (
                  <p className="text-[11px] text-ink-muted">
                    Dispatched: {formatDateTime(order.dispatchDetails.dispatchDate)}
                  </p>
                )}
              </div>
            )}

            {order.clinicReceipt && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  Confirmed Received by Clinic ({order.clinicReceipt.condition})
                </p>
                <p className="text-ink-secondary">
                  Received by <strong>{order.clinicReceipt.receivedBy}</strong> on{' '}
                  {formatDateTime(order.clinicReceipt.receivedAt)}
                </p>
                {order.clinicReceipt.remarks && (
                  <p className="italic text-ink-secondary">&ldquo;{order.clinicReceipt.remarks}&rdquo;</p>
                )}
              </div>
            )}

            {/* INTERNAL LABORATORY PRODUCTION NOTES (Strictly Lab/Admin Only!) */}
            {isLabAuthorized && (
              <div className="pt-3 border-t border-surface-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Internal Lab Bench Notes (Hidden from Clinic &amp; Patients)
                  </p>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {internalNotes.length === 0 ? (
                    <p className="text-ink-muted italic text-[11px]">
                      No internal bench notes recorded yet.
                    </p>
                  ) : (
                    internalNotes.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20"
                      >
                        <div className="flex items-center justify-between text-[10px] text-ink-muted">
                          <strong className="text-ink-primary">{n.authorName}</strong>
                          <span>{formatDateTime(n.createdAt)}</span>
                        </div>
                        <p className="text-ink-secondary mt-0.5">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddInternalNote} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add internal technician note (furnace batch, die spacer, etc.)..."
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-1.5 text-xs outline-none focus:border-purple-500"
                  />
                  <Button type="submit" size="sm" variant="secondary" isLoading={isSavingInternal}>
                    Add Internal
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom 2-Column Grid: Request Audit Timeline + Clinic <-> Lab Communication */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 3: CHRONOLOGICAL AUDIT TIMELINE */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <CardTitle>Request Audit Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto text-xs">
            {!(order.timeline || []).length ? (
              <p className="text-ink-muted italic">
                Submitted on {formatDateTime(order.createdAt)} — Historical case reconciled.
              </p>
            ) : (
              [...(order.timeline || [])].reverse().map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-ink-primary">{evt.title}</p>
                    <span className="text-[10px] font-mono text-ink-muted shrink-0">
                      {formatDateTime(evt.timestamp)}
                    </span>
                  </div>
                  {evt.detail && <p className="text-ink-secondary">{evt.detail}</p>}
                  <p className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                    Recorded by: {evt.actorName} ({evt.actorRole})
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* SECTION 4: CLINIC <-> LABORATORY COMMUNICATION */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <CardTitle>Clinic &amp; Laboratory Communication</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {!(order.communications || []).length ? (
                <p className="text-ink-muted italic py-4 text-center">
                  No clarification threads, updates, or issue messages yet.
                </p>
              ) : (
                (order.communications || []).map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-ink-primary">{msg.actorName}</strong>
                        <Badge variant="primary" size="sm">
                          {msg.type?.replace(/_/g, ' ') || msg.actorRole}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-ink-muted">
                        {formatDateTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-ink-secondary whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendCommunication} className="flex gap-2 pt-2 border-t border-surface-border">
              <input
                type="text"
                placeholder="Post a clinical update, question, or response..."
                value={commMessage}
                onChange={(e) => setCommMessage(e.target.value)}
                className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3.5 py-2 text-xs outline-none focus:border-teal-500"
              />
              <Button type="submit" variant="primary" size="sm" leftIcon={Send} isLoading={isSendingComm}>
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ================= WORKFLOW MODALS ================= */}

      {/* 1. Accept Request Modal */}
      <Modal
        isOpen={activeModal === 'ACCEPT'}
        onClose={() => setActiveModal(null)}
        title="Accept Laboratory Request"
        description={`${order.requestCode} • ${order.applianceType}`}
      >
        <form onSubmit={handleAccept} className="space-y-4">
          <Select
            label="Production Workflow Template"
            value={acceptWorkflowId}
            onChange={(e) => setAcceptWorkflowId(e.target.value)}
            options={Object.values(workflowsMap).map((w) => ({
              value: w.id,
              label: w.name,
            }))}
          />

          <Select
            label="Case Inputs / Materials Readiness"
            value={acceptMaterialsReady ? 'READY' : 'AWAITING'}
            onChange={(e) => setAcceptMaterialsReady(e.target.value === 'READY')}
            options={[
              {
                value: 'READY',
                label: 'Ready for Production (Digital Scan / Inputs Verified)',
              },
              {
                value: 'AWAITING',
                label: 'Awaiting Materials (Waiting for Physical Impression / Stone Model)',
              },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Assigned Technician (Optional)"
              value={acceptTech}
              onChange={(e) => setAcceptTech(e.target.value)}
              placeholder="e.g. Senior Prosthetics Tech"
            />
            <Input
              label="Estimated Completion Date"
              type="date"
              value={acceptEstDate}
              onChange={(e) => setAcceptEstDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Laboratory Fee / Reference Quote (Optional)"
            value={acceptCost}
            onChange={(e) => setAcceptCost(e.target.value)}
            placeholder="e.g. ₱3,500"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Confirm Acceptance
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Clarification / Decline / Respond Modal */}
      <Modal
        isOpen={['CLARIFY', 'DECLINE', 'RESPOND_CLARIFY'].includes(activeModal)}
        onClose={() => setActiveModal(null)}
        title={
          activeModal === 'DECLINE'
            ? 'Decline Laboratory Request (Reason Required)'
            : activeModal === 'CLARIFY'
            ? 'Request Clarification from Clinic'
            : 'Provide Clinical Clarification to Laboratory'
        }
      >
        <form onSubmit={handleClarifyOrDecline} className="space-y-4">
          <textarea
            rows={4}
            required
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={
              activeModal === 'DECLINE'
                ? 'State the reason for declining this request (required)...'
                : activeModal === 'CLARIFY'
                ? 'Specify missing margin details, shade, arch, or scan files needed...'
                : 'Provide the requested clinical specification or updated scan link...'
            }
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={activeModal === 'DECLINE' ? 'danger' : 'primary'}
              isLoading={isSubmitting}
            >
              {activeModal === 'DECLINE'
                ? 'Decline Request'
                : activeModal === 'CLARIFY'
                ? 'Send Clarification Request'
                : 'Submit to Laboratory'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Confirm Material Receipt Modal */}
      <Modal
        isOpen={activeModal === 'MATERIALS'}
        onClose={() => setActiveModal(null)}
        title="Confirm Physical Material Receipt"
        description="Verify physical impression, stone cast, or repair appliance arrival."
      >
        <form onSubmit={handleConfirmMaterials} className="space-y-4">
          <Input
            label="Material Intake & Disinfection Condition"
            value={materialCondition}
            onChange={(e) => setMaterialCondition(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Mark Ready for Production
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Start Production Modal */}
      <Modal
        isOpen={activeModal === 'START_PROD'}
        onClose={() => setActiveModal(null)}
        exitImmediately
        title="Start Appliance Fabrication"
      >
        <form onSubmit={handleStartProduction} className="space-y-4">
          <Select
            label="Workflow Template"
            value={acceptWorkflowId}
            onChange={(e) => setAcceptWorkflowId(e.target.value)}
            options={Object.values(workflowsMap).map((w) => ({
              value: w.id,
              label: w.name,
            }))}
          />
          <Input
            label="Assigned Technician"
            value={acceptTech}
            onChange={(e) => setAcceptTech(e.target.value)}
            required
          />
          <Input
            label="Estimated Completion Date"
            type="date"
            value={acceptEstDate}
            onChange={(e) => setAcceptEstDate(e.target.value)}
            required
          />
          <Input
            label="Initial Setup Note (Optional)"
            value={stageNote}
            onChange={(e) => setStageNote(e.target.value)}
            placeholder="e.g. Cast articulated and blocked out"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Begin Production
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Update Fabrication Stage Modal */}
      <Modal
        isOpen={activeModal === 'STAGE'}
        onClose={() => setActiveModal(null)}
        exitImmediately
        title={`Update Fabrication Stage (${order.workflowShortName})`}
      >
        <form onSubmit={handleStageUpdate} className="space-y-4">
          <Select
            label="Target Stage"
            value={selectedStageKey}
            onChange={(e) => {
              const key = e.target.value;
              setSelectedStageKey(key);
              const found = (order.workflowStages || []).find((s) => s.key === key);
              setSendForTryIn(Boolean(found?.isTryInStage));
            }}
            options={(order.workflowStages || [])
              .filter((s) => s.phase !== 'DISPATCH')
              .map((s) => ({
                value: s.key,
                label: s.phase === 'QUALITY_CHECK' ? `★ ${s.label} (Finish Fabrication)` : s.label,
              }))}
          />

          {selectedStageKey !== 'QUALITY_CHECK' && (
            <label className="flex items-center gap-2.5 text-xs font-semibold text-ink-primary cursor-pointer p-3 rounded-xl bg-surface-subtle border border-surface-border">
              <input
                type="checkbox"
                checked={sendForTryIn}
                onChange={(e) => setSendForTryIn(e.target.checked)}
                className="rounded text-teal-600"
              />
              <span>Temporarily return case to Clinic for Chairside Wax Try-In / Approval</span>
            </label>
          )}

          <textarea
            rows={2}
            value={stageNote}
            onChange={(e) => setStageNote(e.target.value)}
            placeholder="Optional fabrication progress note..."
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Stage Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Edit Technician / Estimated Date / Supporting Attachment Modal */}
      <Modal
        isOpen={activeModal === 'EDIT_PROD'}
        onClose={() => setActiveModal(null)}
        title="Update Production Details & Supporting Images"
      >
        <form onSubmit={handleSaveProdDetails} className="space-y-4">
          <Input
            label="Assigned Technician"
            value={editTech}
            onChange={(e) => setEditTech(e.target.value)}
          />
          <Input
            label="Estimated Completion Date (Notifies Clinic if changed)"
            type="date"
            value={editEstDate}
            onChange={(e) => setEditEstDate(e.target.value)}
          />

          <div className="space-y-2 pt-2 border-t border-surface-border">
            <p className="text-xs font-bold text-ink-primary">Attach Supporting Fabrication Image</p>
            {isCloudinaryConfigured() && (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="text-xs text-ink-secondary"
              />
            )}
            <Input
              label="Or Image / Scan URL"
              value={attachmentUrlInput}
              onChange={(e) => setAttachmentUrlInput(e.target.value)}
              placeholder="https://..."
            />
            <Input
              label="Attachment Label"
              value={attachmentTitleInput}
              onChange={(e) => setAttachmentTitleInput(e.target.value)}
              placeholder="e.g. Wax-Up Setup Photo / Margin Check"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting || uploadingFile}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Clinic Try-In Decision Modal */}
      <Modal
        isOpen={activeModal === 'TRY_IN_RESPONSE'}
        onClose={() => setActiveModal(null)}
        title="Chairside Try-In Clinical Evaluation"
      >
        <form onSubmit={handleTryInResponse} className="space-y-4">
          <Select
            label="Try-In Outcome"
            value={tryInApproved ? 'APPROVE' : 'ADJUST'}
            onChange={(e) => setTryInApproved(e.target.value === 'APPROVE')}
            options={[
              { value: 'APPROVE', label: 'Approved — Resume Final Processing & Finishing' },
              { value: 'ADJUST', label: 'Adjustment Required — Return to Wax-Up / Setup' },
            ]}
          />
          <textarea
            rows={3}
            required={!tryInApproved}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Record midline, VDO, occlusion, or shade verification notes..."
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Submit Try-In Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. Quality Check Verification Modal */}
      <Modal
        isOpen={activeModal === 'QC'}
        onClose={() => setActiveModal(null)}
        exitImmediately
        title="Laboratory Quality Check"
        description="Quality checking verifies laboratory workmanship and does not replace clinical evaluation or chairside fitting by the dentist."
      >
        <form onSubmit={handleSubmitQc} className="space-y-4 text-xs">
          <Select
            label="Quality Check Result"
            value={qcPassed ? 'PASS' : 'FAIL'}
            onChange={(e) => setQcPassed(e.target.value === 'PASS')}
            options={[
              { value: 'PASS', label: 'PASS — Move to Ready for Pickup / Dispatch' },
              { value: 'FAIL', label: 'FAIL — Return to Fabrication Stage (Reason Required)' },
            ]}
          />

          {qcPassed ? (
            <div className="space-y-2 p-3.5 rounded-2xl bg-surface-subtle border border-surface-border">
              {[
                ['applianceVerified', `Requested appliance verified (${order.applianceType})`],
                ['materialVerified', `Material specifications verified (${order.material})`],
                ['toothOrArchVerified', `Tooth number / dental arch verified (${formatArchAndTeeth(order)})`],
                ['workmanshipVerified', 'Completeness, margins, polish & workmanship inspected'],
                ['prescriptionMatched', 'All dentist prescription instructions matched'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer font-semibold text-ink-primary">
                  <input
                    type="checkbox"
                    checked={qcChecklist[key]}
                    onChange={(e) =>
                      setQcChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : (
            <Select
              label="Return to Fabrication Stage"
              value={qcReturnStage}
              onChange={(e) => setQcReturnStage(e.target.value)}
              options={productionOnlyStages.map((s) => ({
                value: s.key,
                label: s.label,
              }))}
            />
          )}

          <textarea
            rows={3}
            required={!qcPassed}
            value={qcNotes}
            onChange={(e) => setQcNotes(e.target.value)}
            placeholder={
              qcPassed
                ? 'Optional final QC inspection remarks...'
                : 'Document the exact defect/reason for returning to fabrication (required)...'
            }
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={qcPassed ? 'primary' : 'danger'}
              isLoading={isSubmitting}
            >
              {qcPassed ? 'Approve QC & Mark Ready' : 'Record QC Failure & Return'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9. Ready for Pickup / Dispatch Modal */}
      <Modal
        isOpen={activeModal === 'DISPATCH'}
        onClose={() => setActiveModal(null)}
        exitImmediately
        title="Record Ready for Pickup / Dispatch"
        description="Note: Dispatching notifies the clinic and sets status to Awaiting Clinic Receipt. Only authorized clinic staff can mark Completed."
      >
        <form onSubmit={handleDispatchUpdate} className="space-y-4">
          <Select
            label="Delivery Stage"
            value={dispatchSub}
            onChange={(e) => setDispatchSub(e.target.value)}
            options={[
              { value: DISPATCH_SUB_STATUS.READY_FOR_PICKUP, label: 'Ready for Pickup (At Lab)' },
              { value: DISPATCH_SUB_STATUS.IN_TRANSIT, label: 'Dispatched / In Transit' },
              { value: DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT, label: 'Delivered — Awaiting Clinic Receipt' },
            ]}
          />
          <Select
            label="Delivery Method"
            value={deliveryMethod}
            onChange={(e) => setDeliveryMethod(e.target.value)}
            options={[
              { value: 'In-House Clinic Messenger', label: 'In-House Clinic Messenger' },
              { value: 'Clinic Staff Pickup', label: 'Clinic Staff Pickup' },
              { value: 'Dedicated Medical Courier', label: 'Dedicated Medical Courier' },
            ]}
          />
          <Input
            label="Courier Tracking / Pickup Reference (If Applicable)"
            value={courierRef}
            onChange={(e) => setCourierRef(e.target.value)}
            placeholder="e.g. POUCH-204 / Rider Ref"
          />
          <Input
            label="Dispatch Packaging Notes"
            value={dispatchNotes}
            onChange={(e) => setDispatchNotes(e.target.value)}
            placeholder="e.g. Sealed in sterile hydration pouch with articulated cast"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Dispatch Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* 10. Authorized Clinic Receipt Confirmation Modal */}
      <Modal
        isOpen={activeModal === 'CLINIC_RECEIPT'}
        onClose={() => setActiveModal(null)}
        title="Confirm Physical Receipt by Clinic"
        description="Confirming intact physical arrival marks this laboratory request as Completed."
      >
        <form onSubmit={handleClinicReceipt} className="space-y-4">
          <Input
            label="Receiving Clinic Staff Member"
            value={receiptStaff}
            onChange={(e) => setReceiptStaff(e.target.value)}
            required
          />
          <Select
            label="Receipt Condition"
            value={receiptCondition}
            onChange={(e) => setReceiptCondition(e.target.value)}
            options={[
              { value: 'Good / Intact — Matches Prescription', label: 'Good / Intact — Matches Prescription' },
              { value: 'Outer Packaging Worn — Appliance Intact', label: 'Outer Packaging Worn — Appliance Intact' },
            ]}
          />
          <textarea
            rows={2}
            value={receiptRemarks}
            onChange={(e) => setReceiptRemarks(e.target.value)}
            placeholder="Optional clinical receiving remarks..."
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Confirm Receipt &amp; Complete Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* 11. Clinic Report Delivery / Spec Issue Modal */}
      <Modal
        isOpen={activeModal === 'REPORT_ISSUE'}
        onClose={() => setActiveModal(null)}
        title="Report Delivery Damage or Specification Issue"
        description="Blocks completion and alerts the laboratory immediately for tracked resolution."
      >
        <form onSubmit={handleReportIssue} className="space-y-4">
          <Select
            label="Issue Category"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            options={[
              { value: 'Damaged in Transit', label: 'Damaged in Transit' },
              { value: 'Missing Items / Cast / Components', label: 'Missing Items / Cast / Components' },
              { value: 'Incorrect Specifications / Margin Fit', label: 'Incorrect Specifications / Margin Fit' },
              { value: 'Shade Mismatch', label: 'Shade Mismatch' },
            ]}
          />
          <textarea
            rows={3}
            required
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            placeholder="Describe the damage, missing item, or chairside discrepancy..."
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-rose-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Raise Issue with Laboratory
            </Button>
          </div>
        </form>
      </Modal>

      {/* 12. Laboratory Resolve Reported Issue Modal */}
      <Modal
        isOpen={activeModal === 'RESOLVE_ISSUE'}
        onClose={() => setActiveModal(null)}
        title="Resolve Clinic Delivery Issue"
      >
        <form onSubmit={handleResolveIssue} className="space-y-4">
          <Select
            label="Corrective Action"
            value={resolveAction}
            onChange={(e) => setResolveAction(e.target.value)}
            options={[
              { value: 'RETURN_TO_PRODUCTION', label: 'Return to Fabrication / Remake Appliance' },
              { value: 'REDISPATCH', label: 'Dispatch Corrected / Missing Item Now' },
            ]}
          />
          {resolveAction === 'RETURN_TO_PRODUCTION' ? (
            <Select
              label="Fabrication Stage"
              value={qcReturnStage}
              onChange={(e) => setQcReturnStage(e.target.value)}
              options={productionOnlyStages.map((s) => ({ value: s.key, label: s.label }))}
            />
          ) : (
            <Input
              label="Replacement Courier / Pouch Reference"
              value={courierRef}
              onChange={(e) => setCourierRef(e.target.value)}
            />
          )}
          <textarea
            rows={3}
            required
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Document corrective action taken..."
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Resolution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

