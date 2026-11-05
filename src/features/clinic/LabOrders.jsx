import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Truck,
  Clock,
  ShieldAlert,
  Sparkles,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { patientService } from '../../services/patientService';
import { imageService } from '../../services/imageService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/formatters';
import { LAB_MATERIALS, VITA_SHADES } from '../../lib/constants';
import {
  LAB_ORDER_STATUS,
  STATUS_DISPLAY_LABELS,
  MATERIALS_DISPLAY_LABELS,
  DISPATCH_SUB_LABELS,
  INPUT_SUBMISSION_TYPES,
  APPLIANCE_CATEGORIES,
  APPLIANCE_CATEGORY_LABELS,
  DENTAL_ARCHES,
  DEFAULT_WORKFLOW_TEMPLATES,
  APPLIANCE_CATALOG_PRESETS,
  formatArchAndTeeth,
} from '../../lib/labWorkflows';

function getDefaultDueDate(daysAhead = 5) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function LabOrdersManager() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [templatesMap, setTemplatesMap] = useState(DEFAULT_WORKFLOW_TEMPLATES);
  const [patients, setPatients] = useState([]);
  const [patientImages, setPatientImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState(null);

  // Create / Clarification Resubmit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [patientId, setPatientId] = useState('');
  const [manualPatientName, setManualPatientName] = useState('');
  const [applianceType, setApplianceType] = useState('');
  const [category, setCategory] = useState(APPLIANCE_CATEGORIES.CROWNS_BRIDGES);
  const [workflowId, setWorkflowId] = useState('CROWNS_BRIDGES_DIGITAL');
  const [retainerSubtype, setRetainerSubtype] = useState('');
  const [requiresTryIn, setRequiresTryIn] = useState(false);
  const [inputType, setInputType] = useState('DIGITAL_SCAN');
  const [material, setMaterial] = useState(LAB_MATERIALS[0]);
  const [shade, setShade] = useState('A2');
  const [arch, setArch] = useState('NOT_SPECIFIED');
  const [toothNumbersInput, setToothNumbersInput] = useState('');
  const [priority, setPriority] = useState('STANDARD');
  const [vendor, setVendor] = useState('SmileGuard In-House Dental Lab');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(() => getDefaultDueDate(5));
  const [cost, setCost] = useState('₱3,500');
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [cadFileUrl, setCadFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [clarificationReply, setClarificationReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clinic Physical Receipt Confirmation Modal (Phase 2.6)
  const [receiptModalOrder, setReceiptModalOrder] = useState(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [receiptCondition, setReceiptCondition] = useState('Intact & Matches Prescription');
  const [receiptRemarks, setReceiptRemarks] = useState('');

  // Clinic Delivery / Specification Issue Modal (Phase 2.6 & Scenario F)
  const [issueModalOrder, setIssueModalOrder] = useState(null);
  const [issueType, setIssueType] = useState('Incorrect Specifications / Fit');
  const [issueDescription, setIssueDescription] = useState('');

  // Clinic Wax Try-In Review Modal (Phase 3 Workflow C)
  const [tryInModalOrder, setTryInModalOrder] = useState(null);
  const [tryInApproved, setTryInApproved] = useState(true);
  const [tryInNotes, setTryInNotes] = useState('');

  useEffect(() => {
    setLoading(true);
    let mounted = true;

    patientService
      .listPatients()
      .then((patList) => {
        if (mounted) {
          setPatients(patList || []);
          if (patList && patList.length > 0) {
            setPatientId((prev) => prev || patList[0].id);
          } else {
            setPatientId('WALK_IN');
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load patients for lab request form:', err);
        if (mounted) setPatientId('WALK_IN');
      });

    const unsubTemplates = laboratoryService.subscribeWorkflowTemplates((map) => {
      if (mounted) setTemplatesMap(map);
    });

    const unsubOrders = laboratoryService.subscribeToOrders((liveOrders) => {
      if (mounted) {
        setOrders(liveOrders);
        setLoading(false);
      }
    }, user);

    return () => {
      mounted = false;
      unsubTemplates();
      unsubOrders();
    };
  }, [user?.id, user?.uid, user?.role]);

  useEffect(() => {
    if (!isFormOpen || !patientId || patientId === 'WALK_IN') {
      setPatientImages([]);
      return;
    }
    imageService
      .getPatientImages(patientId)
      .then((imgs) => setPatientImages(imgs || []))
      .catch(() => setPatientImages([]));
  }, [isFormOpen, patientId]);

  const applyPreset = (preset) => {
    setApplianceType(preset.label);
    setCategory(preset.category);
    setWorkflowId(preset.workflowId);
    setMaterial(preset.defaultMaterial || LAB_MATERIALS[0]);
    setShade(preset.defaultShade || 'A2');
    setInputType(preset.defaultInputType || 'DIGITAL_SCAN');
    setRetainerSubtype(preset.retainerSubtype || '');
    setRequiresTryIn(Boolean(preset.requiresTryIn));
    if (
      preset.category === APPLIANCE_CATEGORIES.ORTHO_RETAINERS ||
      preset.category === APPLIANCE_CATEGORIES.DENTURES
    ) {
      setArch((prev) => (prev === 'NOT_SPECIFIED' ? 'UPPER_ARCH' : prev));
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    if (patients.length > 0) {
      setPatientId((prev) => (prev && prev !== 'WALK_IN' ? prev : patients[0].id));
    } else {
      setPatientId('WALK_IN');
    }
    setManualPatientName('');
    setApplianceType('');
    setCategory(APPLIANCE_CATEGORIES.CROWNS_BRIDGES);
    setWorkflowId('CROWNS_BRIDGES_DIGITAL');
    setRetainerSubtype('');
    setRequiresTryIn(false);
    setInputType('DIGITAL_SCAN');
    setMaterial(LAB_MATERIALS[0]);
    setShade('A2');
    setArch('NOT_SPECIFIED');
    setToothNumbersInput('');
    setPriority('STANDARD');
    setVendor('SmileGuard In-House Dental Lab');
    setEstimatedCompletionDate(getDefaultDueDate(5));
    setCost('₱3,500');
    setSelectedAttachmentId('');
    setCadFileUrl('');
    setNotes('');
    setClarificationReply('');
    setIsFormOpen(true);
  };

  const openClarificationModal = (order) => {
    setEditingOrder(order);
    setPatientId(order.patientId || 'WALK_IN');
    setManualPatientName(order.patientName || '');
    setApplianceType(order.applianceType || '');
    setCategory(order.category || APPLIANCE_CATEGORIES.CROWNS_BRIDGES);
    setWorkflowId(order.workflowId || 'CROWNS_BRIDGES_DIGITAL');
    setRetainerSubtype(order.retainerSubtype || '');
    setRequiresTryIn(Boolean(order.requiresTryIn));
    setInputType(order.inputType || 'DIGITAL_SCAN');
    setMaterial(order.material || LAB_MATERIALS[0]);
    setShade(order.shade || 'A2');
    setArch(order.arch || 'NOT_SPECIFIED');
    setToothNumbersInput((order.toothNumbers || []).join(', '));
    setPriority(order.priority || 'STANDARD');
    setVendor(order.vendor || 'SmileGuard In-House Dental Lab');
    setEstimatedCompletionDate(
      order.estimatedCompletionDate || order.targetDeliveryDate || getDefaultDueDate(5)
    );
    setCost(order.cost || '');
    setSelectedAttachmentId('');
    setCadFileUrl(order.cadFileUrl || '');
    setNotes(order.notes || '');
    setClarificationReply('');
    setIsFormOpen(true);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!applianceType.trim()) {
      toast.error('Please enter or choose an Appliance / Service Requested.');
      return;
    }

    const selectedPat = patients.find((p) => p.id === patientId);
    const resolvedPatientName =
      patientId === 'WALK_IN'
        ? manualPatientName.trim() || 'Clinic Case Patient'
        : selectedPat?.fullName || manualPatientName.trim() || 'Patient';
    const resolvedPatientId =
      patientId === 'WALK_IN' ? `walkin_${Date.now().toString(36)}` : patientId || '';
    const chosenImg = patientImages.find((img) => img.id === selectedAttachmentId);

    setIsSubmitting(true);
    try {
      const actorName = user?.fullName || user?.name || 'Dentist';

      if (editingOrder) {
        await laboratoryService.respondToClarification(
          editingOrder.id,
          {
            applianceType: applianceType.trim(),
            material,
            shade,
            arch,
            priority,
            toothNumbers: toothNumbersInput,
            estimatedCompletionDate,
            cadFileUrl,
            attachmentUrl: chosenImg
              ? chosenImg.secureUrl || chosenImg.imageUrl
              : editingOrder.attachmentUrl,
            attachmentTitle: chosenImg ? chosenImg.title : editingOrder.attachmentTitle,
            notes,
            responseMessage: clarificationReply || notes,
          },
          user
        );
        toast.success('Clarification response submitted — returned to Laboratory Pending Review!');
      } else {
        await laboratoryService.create(
          {
            patientId: resolvedPatientId,
            patientName: resolvedPatientName,
            dentistId: user?.id || user?.uid || '',
            dentistName: actorName,
            applianceType: applianceType.trim(),
            category,
            workflowId,
            retainerSubtype,
            requiresTryIn,
            inputType,
            material,
            shade,
            arch,
            priority,
            toothNumbers: toothNumbersInput,
            vendor,
            estimatedCompletionDate,
            targetDeliveryDate: estimatedCompletionDate,
            cost,
            cadFileUrl,
            attachmentUrl: chosenImg ? chosenImg.secureUrl || chosenImg.imageUrl : '',
            attachmentTitle: chosenImg ? chosenImg.title : '',
            notes,
          },
          user
        );
        toast.success('Laboratory prescription submitted to Laboratory Pending Review!');
      }

      setIsFormOpen(false);
      setEditingOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to submit laboratory prescription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReceiptModal = (order) => {
    setReceiptModalOrder(order);
    setReceivedBy(user?.fullName || user?.name || 'Clinic Staff');
    setReceiptCondition('Intact & Matches Prescription');
    setReceiptRemarks('');
  };

  const submitClinicReceipt = async (e) => {
    e.preventDefault();
    if (!receiptModalOrder) return;
    setBusyId(receiptModalOrder.id);
    try {
      await laboratoryService.confirmClinicReceipt(
        receiptModalOrder.id,
        {
          receivedBy,
          receivedAt: new Date().toISOString(),
          condition: receiptCondition,
          remarks: receiptRemarks,
        },
        user
      );
      toast.success(
        `Confirmed physical receipt of ${receiptModalOrder.requestCode} — Marked Completed!`
      );
      setReceiptModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm clinic receipt.');
    } finally {
      setBusyId(null);
    }
  };

  const openIssueModal = (order) => {
    setIssueModalOrder(order);
    setIssueType('Incorrect Specifications / Fit');
    setIssueDescription('');
  };

  const submitClinicIssue = async (e) => {
    e.preventDefault();
    if (!issueModalOrder) return;
    setBusyId(issueModalOrder.id);
    try {
      await laboratoryService.reportClinicIssue(
        issueModalOrder.id,
        {
          issueType,
          description: issueDescription,
        },
        user
      );
      toast.info(
        `Issue reported on ${issueModalOrder.requestCode}. Laboratory notified for resolution.`
      );
      setIssueModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to report delivery issue.');
    } finally {
      setBusyId(null);
    }
  };

  const openTryInModal = (order) => {
    setTryInModalOrder(order);
    setTryInApproved(true);
    setTryInNotes('');
  };

  const submitTryInDecision = async (e) => {
    e.preventDefault();
    if (!tryInModalOrder) return;
    setBusyId(tryInModalOrder.id);
    try {
      await laboratoryService.respondToClinicTryIn(
        tryInModalOrder.id,
        {
          approved: tryInApproved,
          dentistNotes: tryInNotes,
        },
        user
      );
      toast.success(
        tryInApproved
          ? `Approved Wax Try-In for ${tryInModalOrder.requestCode} — Laboratory resuming final processing!`
          : `Requested Wax-Up adjustment on ${tryInModalOrder.requestCode}.`
      );
      setTryInModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to record try-in decision.');
    } finally {
      setBusyId(null);
    }
  };

  // Filtered Lists
  const clarificationOrders = useMemo(
    () => orders.filter((o) => o.status === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED),
    [orders]
  );

  const tryInOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === LAB_ORDER_STATUS.IN_PRODUCTION && o.tryInStatus === 'SENT_TO_CLINIC'
      ),
    [orders]
  );

  const awaitingReceiptOrders = useMemo(
    () =>
      orders.filter((o) =>
        [LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(o.status)
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'IN_FABRICATION') {
        return [
          LAB_ORDER_STATUS.ACCEPTED,
          LAB_ORDER_STATUS.IN_PRODUCTION,
          LAB_ORDER_STATUS.QUALITY_CHECK,
        ].includes(o.status);
      }
      if (statusFilter === 'AWAITING_RECEIPT') {
        return [LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(
          o.status
        );
      }
      return o.status === statusFilter;
    });
  }, [orders, statusFilter]);

  const tabs = [
    { id: 'ALL', label: 'All Requests', badge: orders.length },
    {
      id: LAB_ORDER_STATUS.PENDING_REVIEW,
      label: 'Pending Review',
      badge: orders.filter((o) => o.status === LAB_ORDER_STATUS.PENDING_REVIEW).length,
    },
    {
      id: LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
      label: 'Needs Clarification',
      badge: clarificationOrders.length,
    },
    {
      id: 'IN_FABRICATION',
      label: 'Accepted / In Production',
      badge: orders.filter((o) =>
        [
          LAB_ORDER_STATUS.ACCEPTED,
          LAB_ORDER_STATUS.IN_PRODUCTION,
          LAB_ORDER_STATUS.QUALITY_CHECK,
        ].includes(o.status)
      ).length,
    },
    {
      id: 'AWAITING_RECEIPT',
      label: 'Ready / Confirm Receipt',
      badge: awaitingReceiptOrders.length,
    },
    {
      id: LAB_ORDER_STATUS.ISSUE_REPORTED,
      label: 'Issues',
      badge: orders.filter((o) => o.status === LAB_ORDER_STATUS.ISSUE_REPORTED).length,
    },
    {
      id: LAB_ORDER_STATUS.COMPLETED,
      label: 'Completed',
      badge: orders.filter((o) => o.status === LAB_ORDER_STATUS.COMPLETED).length,
    },
  ];

  const selectedWorkflowObj = templatesMap[workflowId] || DEFAULT_WORKFLOW_TEMPLATES.OTHER_CUSTOM;

  const patientOptions = [
    ...patients.map((p) => ({
      value: p.id,
      label: p.fullName || p.email || p.id,
    })),
    { value: 'WALK_IN', label: '+ Walk-In / Enter Patient Name Manually' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Laboratory Synchronization
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Dental Laboratory Prescriptions
          </h2>
          <p className="text-sm text-ink-secondary">
            Submit orthodontic, prosthetic, denture, and repair prescriptions to the Laboratory Portal, monitor fabrication stages, and confirm physical clinic receipt.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          leftIcon={Plus}
        >
          New Lab Request
        </Button>
      </div>

      {/* Action Banner 1: Clarification Requested */}
      {clarificationOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>
                {clarificationOrders.length} laboratory{' '}
                {clarificationOrders.length === 1 ? 'request needs' : 'requests need'} dentist clarification
              </strong>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                {clarificationOrders[0].requestCode} ({clarificationOrders[0].applianceType}): &ldquo;
                {clarificationOrders[0].revisionReason}&rdquo;
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={RotateCcw}
            onClick={() => openClarificationModal(clarificationOrders[0])}
            className="shrink-0"
          >
            Respond &amp; Resubmit
          </Button>
        </div>
      )}

      {/* Action Banner 2: Wax Try-In Waiting for Chairside Dentist Approval */}
      {tryInOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs sm:text-sm text-sky-900 dark:text-sky-200">
            <Sparkles className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <strong>
                {tryInOrders.length} case {tryInOrders.length === 1 ? 'is' : 'are'} awaiting chairside Try-In approval
              </strong>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/80 mt-0.5">
                Evaluate {tryInOrders[0].requestCode} ({tryInOrders[0].applianceType} •{' '}
                {tryInOrders[0].patientName}) and approve final processing.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => openTryInModal(tryInOrders[0])}
            className="shrink-0"
          >
            Review Try-In
          </Button>
        </div>
      )}

      {/* Action Banner 3: Ready / Dispatched Appliances Awaiting Physical Clinic Receipt */}
      {awaitingReceiptOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
            <Truck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong>
                {awaitingReceiptOrders.length}{' '}
                {awaitingReceiptOrders.length === 1 ? 'appliance is' : 'appliances are'} Ready or Dispatched — awaiting Clinic Receipt confirmation
              </strong>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                Inspect incoming appliances and confirm physical receipt to mark requests Completed, or report any transit/specification issues.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={CheckCircle2}
            onClick={() => openReceiptModal(awaitingReceiptOrders[0])}
            className="shrink-0"
          >
            Confirm Receipt
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {/* Orders List */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No laboratory prescriptions in this view"
          description="Submit a new laboratory request above to send prescriptions directly to the Laboratory Portal."
          actionLabel="New Lab Request"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => {
            const currentStageObj = (order.workflowStages || []).find(
              (s) => s.key === order.productionStage
            );
            const canConfirmReceipt = [
              LAB_ORDER_STATUS.READY_FOR_DISPATCH,
              LAB_ORDER_STATUS.DISPATCHED,
            ].includes(order.status);

            return (
              <Card
                key={order.id}
                className="p-5 hover:border-teal-500/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                      {order.requestCode}
                    </span>
                    <Badge status={order.status} size="sm" showDot>
                      {STATUS_DISPLAY_LABELS[order.status] || order.status}
                    </Badge>
                    {order.status === LAB_ORDER_STATUS.ACCEPTED && order.materialsStatus && (
                      <Badge status={order.materialsStatus} size="sm">
                        {MATERIALS_DISPLAY_LABELS[order.materialsStatus]}
                      </Badge>
                    )}
                    {order.status === LAB_ORDER_STATUS.IN_PRODUCTION && currentStageObj && (
                      <Badge variant="primary" size="sm">
                        Stage: {currentStageObj.label}
                      </Badge>
                    )}
                    {order.tryInStatus === 'SENT_TO_CLINIC' && (
                      <Badge status="SENT_TO_CLINIC" size="sm">
                        Wax Try-In at Clinic
                      </Badge>
                    )}
                    {canConfirmReceipt && order.dispatchSubStatus && (
                      <Badge status={order.dispatchSubStatus} size="sm">
                        {DISPATCH_SUB_LABELS[order.dispatchSubStatus]}
                      </Badge>
                    )}
                    {order.priority === 'RUSH' && (
                      <Badge variant="danger" size="sm">
                        RUSH
                      </Badge>
                    )}
                    {order.isOverdue && (
                      <Badge status="OVERDUE" size="sm">
                        Overdue
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-base text-ink-primary">
                      {order.applianceType}{' '}
                      <span className="text-sm font-medium text-ink-secondary">
                        • Patient: {order.patientName} ({order.caseReference})
                      </span>
                    </h3>
                    <p className="text-xs text-ink-secondary mt-0.5">
                      Workflow: <strong>{order.workflowShortName}</strong> • Material: {order.material}
                      {order.shade ? ` • Shade ${order.shade}` : ''} •{' '}
                      <span className="font-mono text-teal-700 dark:text-teal-400">
                        {formatArchAndTeeth(order)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Requested: {formatDate(order.createdAt)}
                    </span>
                    <span>
                      Expected Completion:{' '}
                      <strong className="text-ink-primary">
                        {order.estimatedCompletionDate
                          ? formatDate(order.estimatedCompletionDate)
                          : 'TBD'}
                      </strong>
                    </span>
                    {order.assignedTech && (
                      <span>
                        Technician: <strong className="text-ink-primary">{order.assignedTech}</strong>
                      </span>
                    )}
                    {order.clinicReceipt?.receivedAt && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Received by {order.clinicReceipt.receivedBy} on{' '}
                        {formatDate(order.clinicReceipt.receivedAt)}
                      </span>
                    )}
                  </div>

                  {order.status === LAB_ORDER_STATUS.DECLINED && order.declineReason && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-200">
                      <strong>Declined by Laboratory:</strong> {order.declineReason}
                    </div>
                  )}
                </div>

                {/* Clinic Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {order.status === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={RotateCcw}
                      onClick={() => openClarificationModal(order)}
                    >
                      Provide Clarification
                    </Button>
                  )}

                  {order.status === LAB_ORDER_STATUS.IN_PRODUCTION &&
                    order.tryInStatus === 'SENT_TO_CLINIC' && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        leftIcon={Sparkles}
                        onClick={() => openTryInModal(order)}
                      >
                        Approve / Review Try-In
                      </Button>
                    )}

                  {canConfirmReceipt && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        leftIcon={CheckCircle2}
                        isLoading={busyId === order.id}
                        onClick={() => openReceiptModal(order)}
                      >
                        Confirm Receipt
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        leftIcon={ShieldAlert}
                        isLoading={busyId === order.id}
                        onClick={() => openIssueModal(order)}
                      >
                        Report Issue
                      </Button>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={Eye}
                    onClick={() => navigate(`/clinic/lab-orders/${order.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal 1: Create / Respond to Clarification */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          editingOrder
            ? `Respond to Lab Clarification (${editingOrder.requestCode})`
            : 'Submit Dental Laboratory Prescription'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitOrder} className="space-y-4">
          {editingOrder?.revisionReason && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
              <strong>Laboratory Clarification Question:</strong> &ldquo;{editingOrder.revisionReason}&rdquo;
            </div>
          )}

          {!editingOrder && (
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                Quick Appliance Presets (Auto-selects Service Workflow)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {APPLIANCE_CATALOG_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      applianceType === preset.label
                        ? 'bg-teal-600 text-white border-teal-500'
                        : 'bg-surface-subtle text-ink-secondary border-surface-border hover:border-teal-500/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Patient"
              placeholder=""
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={Boolean(editingOrder)}
              options={patientOptions}
            />

            <Input
              label="Appliance / Service Requested"
              value={applianceType}
              onChange={(e) => setApplianceType(e.target.value)}
              placeholder="e.g., Hawley Retainer, Monolithic Zirconia Crown, Complete Denture"
              required
            />
          </div>

          {patientId === 'WALK_IN' && !editingOrder && (
            <Input
              label="Patient Name / Case Identifier"
              value={manualPatientName}
              onChange={(e) => setManualPatientName(e.target.value)}
              placeholder="Enter patient full name or clinic chart reference"
              required
            />
          )}

          {!editingOrder && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Appliance Category"
                placeholder=""
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={Object.entries(APPLIANCE_CATEGORY_LABELS).map(([val, lbl]) => ({
                  value: val,
                  label: lbl,
                }))}
              />

              <Select
                label="Fabrication Workflow"
                placeholder=""
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                options={Object.values(templatesMap).map((tpl) => ({
                  value: tpl.id,
                  label: tpl.shortName || tpl.name,
                }))}
              />
            </div>
          )}

          {!editingOrder && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Case Input / Impression Submission"
                placeholder=""
                value={inputType}
                onChange={(e) => setInputType(e.target.value)}
                options={INPUT_SUBMISSION_TYPES.map((it) => ({
                  value: it.value,
                  label: it.label,
                }))}
              />

              <Select
                label="Assigned Laboratory"
                placeholder=""
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                options={[
                  {
                    value: 'SmileGuard In-House Dental Lab',
                    label: 'SmileGuard In-House Dental Lab',
                  },
                  {
                    value: 'Metro Prosthodontic Partner Lab',
                    label: 'Metro Prosthodontic Partner Lab',
                  },
                  {
                    value: 'OrthoPrecision Appliance Lab',
                    label: 'OrthoPrecision Appliance Lab',
                  },
                ]}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Material Specification"
              placeholder=""
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              options={LAB_MATERIALS.map((m) => ({ value: m, label: m }))}
            />

            <Select
              label="Shade / Finish"
              placeholder=""
              value={shade}
              onChange={(e) => setShade(e.target.value)}
              options={VITA_SHADES.map((s) => ({ value: s, label: s }))}
            />

            <Select
              label="Priority"
              placeholder=""
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'STANDARD', label: 'Standard Turnaround' },
                { value: 'RUSH', label: 'RUSH / Urgent Case' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Dental Arch"
              placeholder=""
              value={arch}
              onChange={(e) => setArch(e.target.value)}
              options={DENTAL_ARCHES}
            />

            <Input
              label="Tooth Numbers (FDI, Optional)"
              value={toothNumbersInput}
              onChange={(e) => setToothNumbersInput(e.target.value)}
              placeholder="e.g., 11, 21 or 36"
            />

            <Input
              label="Requested Completion Date"
              type="date"
              value={estimatedCompletionDate}
              onChange={(e) => setEstimatedCompletionDate(e.target.value)}
              required
            />
          </div>

          {!editingOrder && selectedWorkflowObj?.supportsTryIn && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink-primary cursor-pointer">
              <input
                type="checkbox"
                checked={requiresTryIn}
                onChange={(e) => setRequiresTryIn(e.target.checked)}
                className="rounded border-surface-border text-teal-600 focus:ring-teal-500"
              />
              <span>
                <strong>Request Chairside Try-In / Approval Before Final Processing</strong>{' '}
                (Recommended for complete/partial dentures and complex frameworks)
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Attach Patient Radiograph / Clinical Photo (Optional)"
              placeholder=""
              value={selectedAttachmentId}
              onChange={(e) => setSelectedAttachmentId(e.target.value)}
              options={[
                { value: '', label: 'No patient radiograph attached' },
                ...patientImages.map((img) => ({
                  value: img.id,
                  label: img.title || 'Clinical Radiograph / Scan',
                })),
              ]}
            />

            <Input
              label="Digital Intraoral Scan / STL Link (Optional)"
              value={cadFileUrl}
              onChange={(e) => setCadFileUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Dentist Prescription Instructions &amp; Clinical Design Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specify clasp design, pontic ridge lap, occlusal clearance, labial bow loop placement, or repair details..."
              className="w-full rounded-xl bg-surface-subtle border border-surface-border px-3.5 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-teal-500"
            />
          </div>

          {editingOrder && (
            <Input
              label="Direct Clarification Reply to Laboratory"
              value={clarificationReply}
              onChange={(e) => setClarificationReply(e.target.value)}
              placeholder="Summarize the updated clinical specification or answer..."
              required
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingOrder ? 'Submit Clarification & Resubmit' : 'Send Prescription to Laboratory'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Confirm Physical Clinic Receipt (Phase 2.6) */}
      <Modal
        isOpen={Boolean(receiptModalOrder)}
        onClose={() => setReceiptModalOrder(null)}
        title="Confirm Physical Clinic Receipt"
        maxWidth="max-w-lg"
      >
        {receiptModalOrder && (
          <form onSubmit={submitClinicReceipt} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200">
              Confirming physical receipt verifies the appliance arrived safely at the clinic and marks{' '}
              <strong>{receiptModalOrder.requestCode}</strong> ({receiptModalOrder.applianceType}) as{' '}
              <strong>Completed</strong>. If damaged or incorrect, click Cancel and use{' '}
              <strong>Report Issue</strong> instead.
            </div>

            <Input
              label="Receiving Authorized Clinic Staff / Dentist"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              required
            />

            <Select
              label="Physical Receipt Condition"
              placeholder=""
              value={receiptCondition}
              onChange={(e) => setReceiptCondition(e.target.value)}
              options={[
                { value: 'Intact & Matches Prescription', label: 'Intact & Matches Prescription' },
                {
                  value: 'Intact — Minor Chairside Adjustment Planned',
                  label: 'Intact — Minor Chairside Adjustment Planned',
                },
                {
                  value: 'Sealed & Sanitized Packaging Verified',
                  label: 'Sealed & Sanitized Packaging Verified',
                },
              ]}
            />

            <Input
              label="Optional Clinical Receipt Remarks"
              value={receiptRemarks}
              onChange={(e) => setReceiptRemarks(e.target.value)}
              placeholder="e.g., Ready for patient's 2:00 PM delivery appointment"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setReceiptModalOrder(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={busyId === receiptModalOrder.id}
              >
                Confirm Receipt &amp; Complete
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Report Delivery / Specification Issue (Phase 2.6 & Scenario F) */}
      <Modal
        isOpen={Boolean(issueModalOrder)}
        onClose={() => setIssueModalOrder(null)}
        title="Report Delivery or Specification Issue"
        maxWidth="max-w-lg"
      >
        {issueModalOrder && (
          <form onSubmit={submitClinicIssue} className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200">
              Reporting an issue keeps <strong>{issueModalOrder.requestCode}</strong> open under{' '}
              <strong>Issue Reported</strong> and alerts the laboratory immediately for remake, repair, or replacement.
            </div>

            <Select
              label="Issue Category"
              placeholder=""
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              options={[
                { value: 'Damaged in Transit', label: 'Damaged / Fractured in Transit' },
                {
                  value: 'Missing Items / Attachments',
                  label: 'Missing Items / Opposing Cast / Parts',
                },
                {
                  value: 'Incorrect Specifications / Fit',
                  label: 'Incorrect Material, Shade, Tooth/Arch, or Margin Fit',
                },
              ]}
            />

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Detailed Discrepancy Description (Required)
              </label>
              <textarea
                rows={3}
                required
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the damage, missing component, or clinical fit discrepancy..."
                className="w-full rounded-xl bg-surface-subtle border border-surface-border px-3.5 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setIssueModalOrder(null)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" isLoading={busyId === issueModalOrder.id}>
                Raise Issue with Laboratory
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 4: Chairside Try-In Evaluation (Workflow C) */}
      <Modal
        isOpen={Boolean(tryInModalOrder)}
        onClose={() => setTryInModalOrder(null)}
        title="Chairside Wax Try-In Evaluation"
        maxWidth="max-w-lg"
      >
        {tryInModalOrder && (
          <form onSubmit={submitTryInDecision} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTryInApproved(true)}
                className={`p-3 rounded-xl border text-xs font-bold ${
                  tryInApproved
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : 'bg-surface-subtle border-surface-border text-ink-secondary'
                }`}
              >
                Approve &rarr; Final Processing
              </button>
              <button
                type="button"
                onClick={() => setTryInApproved(false)}
                className={`p-3 rounded-xl border text-xs font-bold ${
                  !tryInApproved
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                    : 'bg-surface-subtle border-surface-border text-ink-secondary'
                }`}
              >
                Request Wax Setup Reset
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Clinical Try-In Notes (VDO, Centric Relation, Midline, Shade)
              </label>
              <textarea
                rows={3}
                required={!tryInApproved}
                value={tryInNotes}
                onChange={(e) => setTryInNotes(e.target.value)}
                placeholder={
                  tryInApproved
                    ? 'e.g., VDO, phonetics, and midline verified chairside. Proceed to acrylization/processing.'
                    : 'Specify tooth position or bite adjustment needed...'
                }
                className="w-full rounded-xl bg-surface-subtle border border-surface-border px-3.5 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setTryInModalOrder(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={busyId === tryInModalOrder.id}
              >
                Submit Try-In Decision
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
export default LabOrdersManager;
