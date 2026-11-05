import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ShieldCheck,
  Clock,
  Play,
  PackageCheck,
  Eye,
  Layers,
  Wrench,
} from 'lucide-react';
import { laboratoryService } from '../../services/laboratoryService';
import {
  LAB_ORDER_STATUS,
  STATUS_DISPLAY_LABELS,
  MATERIALS_STATUS,
  MATERIALS_DISPLAY_LABELS,
  DISPATCH_SUB_STATUS,
  DISPATCH_SUB_LABELS,
  DEFAULT_WORKFLOW_TEMPLATES,
  formatArchAndTeeth,
} from '../../lib/labWorkflows';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

const OVERVIEW_COLUMNS = [
  {
    key: 'ACCEPTED_QUEUE',
    label: 'Accepted / Prep',
    desc: 'Awaiting materials or ready to start fabrication',
  },
  {
    key: 'IN_PRODUCTION',
    label: 'In Production',
    desc: 'Active service-specific bench or digital fabrication',
  },
  {
    key: 'TRY_IN_OR_ISSUE',
    label: 'Clinic Try-In / Issues',
    desc: 'Cases at clinic for wax try-in or issue resolution',
  },
  {
    key: 'QUALITY_CHECK',
    label: 'Quality Check',
    desc: 'Rx specification & workmanship verification',
  },
  {
    key: 'READY_DISPATCH',
    label: 'Ready / Dispatched',
    desc: 'Ready for pickup or awaiting clinic receipt',
  },
];

function getRetainerFabricationDetail(order) {
  const txt = `${order.retainerSubtype || ''} ${order.applianceType || ''} ${order.material || ''}`.toLowerCase();
  if (txt.includes('hawley') || txt.includes('wire')) {
    return 'Hawley Protocol: .028 SS labial bow & Adams clasp wire bending + PMMA acrylic salt-and-pepper cure';
  }
  if (txt.includes('essix') || txt.includes('clear') || txt.includes('thermoform') || txt.includes('petg')) {
    return 'Clear Retainer Protocol: Blocked-out arch cast + vacuum/pressure PETG sheet thermoforming & gingival scalloping';
  }
  return null;
}

export function LabOrdersQueue() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [templatesMap, setTemplatesMap] = useState(DEFAULT_WORKFLOW_TEMPLATES);
  const [selectedBoard, setSelectedBoard] = useState('ALL_ACTIVE');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Start Production Modal
  const [startModalOrder, setStartModalOrder] = useState(null);
  const [startTech, setStartTech] = useState('');
  const [startNote, setStartNote] = useState('');

  // Stage Advance / Try-In Modal
  const [stageModalData, setStageModalData] = useState(null); // { order, nextStage }
  const [stageProgressNote, setStageProgressNote] = useState('');
  const [sendForTryIn, setSendForTryIn] = useState(false);

  // Quality Check Gate Modal
  const [qcModalOrder, setQcModalOrder] = useState(null);
  const [qcDecision, setQcDecision] = useState('PASS');
  const [qcChecklist, setQcChecklist] = useState({
    applianceVerified: true,
    materialVerified: true,
    toothOrArchVerified: true,
    workmanshipVerified: true,
    prescriptionMatched: true,
  });
  const [qcReturnStage, setQcReturnStage] = useState('');
  const [qcNotes, setQcNotes] = useState('');

  // Dispatch Modal
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [dispatchSubStatus, setDispatchSubStatus] = useState(DISPATCH_SUB_STATUS.IN_TRANSIT);
  const [deliveryMethod, setDeliveryMethod] = useState('Clinic Messenger');
  const [courierRef, setCourierRef] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsubTemplates = laboratoryService.subscribeWorkflowTemplates((map) => {
      setTemplatesMap(map);
    });
    const unsubOrders = laboratoryService.subscribeToOrders((liveOrders) => {
      setOrders(liveOrders);
      setLoading(false);
    }, user);

    return () => {
      unsubTemplates();
      unsubOrders();
    };
  }, [user]);

  const workflowTabs = useMemo(() => {
    const allTemplates = Object.values(templatesMap);
    const activeOrders = orders.filter(
      (o) =>
        ![
          LAB_ORDER_STATUS.PENDING_REVIEW,
          LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
          LAB_ORDER_STATUS.DECLINED,
          LAB_ORDER_STATUS.COMPLETED,
        ].includes(o.status)
    );

    return [
      {
        id: 'ALL_ACTIVE',
        label: 'All Active Workflows',
        count: activeOrders.length,
      },
      ...allTemplates.map((tpl) => ({
        id: tpl.id,
        label: tpl.shortName || tpl.name,
        count: activeOrders.filter((o) => o.workflowId === tpl.id).length,
      })),
    ];
  }, [templatesMap, orders]);

  const incomingCount = useMemo(
    () =>
      orders.filter((o) =>
        [LAB_ORDER_STATUS.PENDING_REVIEW, LAB_ORDER_STATUS.CLARIFICATION_REQUESTED].includes(o.status)
      ).length,
    [orders]
  );

  const inFabricationCount = useMemo(
    () =>
      orders.filter((o) =>
        [LAB_ORDER_STATUS.IN_PRODUCTION, LAB_ORDER_STATUS.QUALITY_CHECK].includes(o.status)
      ).length,
    [orders]
  );

  const selectedTemplate = selectedBoard !== 'ALL_ACTIVE' ? templatesMap[selectedBoard] : null;

  // Compute columns & matching orders for current board mode
  const boardColumns = useMemo(() => {
    const boardOrders = orders.filter(
      (o) =>
        ![
          LAB_ORDER_STATUS.PENDING_REVIEW,
          LAB_ORDER_STATUS.CLARIFICATION_REQUESTED,
          LAB_ORDER_STATUS.DECLINED,
          LAB_ORDER_STATUS.COMPLETED,
        ].includes(o.status)
    );

    if (!selectedTemplate) {
      return OVERVIEW_COLUMNS.map((col) => {
        const colOrders = boardOrders.filter((o) => {
          if (col.key === 'ACCEPTED_QUEUE') return o.status === LAB_ORDER_STATUS.ACCEPTED;
          if (col.key === 'TRY_IN_OR_ISSUE') {
            return (
              o.status === LAB_ORDER_STATUS.ISSUE_REPORTED ||
              (o.status === LAB_ORDER_STATUS.IN_PRODUCTION && o.tryInStatus === 'SENT_TO_CLINIC')
            );
          }
          if (col.key === 'IN_PRODUCTION') {
            return o.status === LAB_ORDER_STATUS.IN_PRODUCTION && o.tryInStatus !== 'SENT_TO_CLINIC';
          }
          if (col.key === 'QUALITY_CHECK') return o.status === LAB_ORDER_STATUS.QUALITY_CHECK;
          if (col.key === 'READY_DISPATCH') {
            return [LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(o.status);
          }
          return false;
        });
        return { ...col, orders: colOrders };
      });
    }

    // Service-Specific Workflow Board Columns
    const wfOrders = boardOrders.filter((o) => o.workflowId === selectedTemplate.id);
    const stages = selectedTemplate.stages || [];
    const firstStageKey = stages[0]?.key;

    return stages.map((stage, idx) => {
      const colOrders = wfOrders.filter((o) => {
        if (stage.phase === 'QUALITY_CHECK' || stage.key === 'QUALITY_CHECK') {
          return o.status === LAB_ORDER_STATUS.QUALITY_CHECK;
        }
        if (stage.phase === 'DISPATCH' || stage.key === 'READY_FOR_DISPATCH') {
          return [LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(o.status);
        }
        if (idx === 0 && [LAB_ORDER_STATUS.ACCEPTED, LAB_ORDER_STATUS.ISSUE_REPORTED].includes(o.status)) {
          return true;
        }
        return (
          o.status === LAB_ORDER_STATUS.IN_PRODUCTION &&
          (o.productionStage === stage.key || (!o.productionStage && stage.key === firstStageKey))
        );
      });

      return {
        key: stage.key,
        label: stage.label,
        desc: stage.desc,
        phase: stage.phase,
        isTryInStage: Boolean(stage.isTryInStage),
        orders: colOrders,
      };
    });
  }, [orders, selectedTemplate]);

  // Handlers
  const handleConfirmMaterials = async (order) => {
    setBusyId(order.id);
    try {
      await laboratoryService.confirmMaterialsReceived(
        order.id,
        { receivedDate: new Date().toISOString() },
        user
      );
      toast.success(`Materials confirmed for ${order.requestCode} — Ready for Production!`);
    } catch (err) {
      toast.error(err.message || 'Failed to confirm material receipt.');
    } finally {
      setBusyId(null);
    }
  };

  const openStartProduction = (order) => {
    setStartModalOrder(order);
    setStartTech(order.assignedTech || user?.fullName || '');
    setStartNote('');
  };

  const submitStartProduction = async (e) => {
    e.preventDefault();
    if (!startModalOrder) return;
    setBusyId(startModalOrder.id);
    try {
      await laboratoryService.startProduction(
        startModalOrder.id,
        {
          assignedTech: startTech,
          note: startNote,
        },
        user
      );
      toast.success(`Started ${startModalOrder.workflowShortName} production for ${startModalOrder.requestCode}`);
      setStartModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Unable to start fabrication.');
    } finally {
      setBusyId(null);
    }
  };

  const getNextProductionStage = (order) => {
    const stages = order.workflowStages || [];
    const currentIdx = stages.findIndex((s) => s.key === order.productionStage);
    if (currentIdx === -1) return stages[1] || null;
    return stages[currentIdx + 1] || null;
  };

  const openAdvanceStage = (order, nextStage) => {
    setStageModalData({ order, nextStage });
    setStageProgressNote('');
    setSendForTryIn(Boolean(nextStage.isTryInStage && order.requiresTryIn));
  };

  const submitAdvanceStage = async (e) => {
    e.preventDefault();
    if (!stageModalData) return;
    const { order, nextStage } = stageModalData;
    setBusyId(order.id);
    try {
      await laboratoryService.updateProductionStage(
        order.id,
        {
          stageKey: nextStage.key,
          progressNote: stageProgressNote,
          sendForClinicTryIn: sendForTryIn,
        },
        user
      );
      toast.success(
        sendForTryIn
          ? `Sent ${order.requestCode} to Clinic for chairside Wax Try-In approval.`
          : `${order.requestCode} moved to ${nextStage.label}`
      );
      setStageModalData(null);
    } catch (err) {
      toast.error(err.message || 'Failed to advance fabrication stage.');
    } finally {
      setBusyId(null);
    }
  };

  const openQualityCheck = (order) => {
    const prodStages = (order.workflowStages || []).filter((s) => s.phase === 'PRODUCTION');
    setQcModalOrder(order);
    setQcDecision('PASS');
    setQcChecklist({
      applianceVerified: true,
      materialVerified: true,
      toothOrArchVerified: true,
      workmanshipVerified: true,
      prescriptionMatched: true,
    });
    setQcReturnStage(prodStages[prodStages.length - 1]?.key || '');
    setQcNotes('');
  };

  const submitQualityCheck = async (e) => {
    e.preventDefault();
    if (!qcModalOrder) return;
    const passed = qcDecision === 'PASS';
    if (passed && !Object.values(qcChecklist).every(Boolean)) {
      toast.error('Verify all 5 Quality Check criteria before passing an appliance.');
      return;
    }
    setBusyId(qcModalOrder.id);
    try {
      await laboratoryService.submitQualityCheck(
        qcModalOrder.id,
        {
          passed,
          checklist: qcChecklist,
          notes: qcNotes,
          returnToStageKey: qcReturnStage,
        },
        user
      );
      toast.success(
        passed
          ? `✨ ${qcModalOrder.requestCode} passed Quality Check — Ready for Pickup / Dispatch!`
          : `Returned ${qcModalOrder.requestCode} to fabrication for correction.`
      );
      setQcModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to record Quality Check.');
    } finally {
      setBusyId(null);
    }
  };

  const openDispatchModal = (order) => {
    setDispatchModalOrder(order);
    setDispatchSubStatus(
      order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH
        ? DISPATCH_SUB_STATUS.IN_TRANSIT
        : DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT
    );
    setDeliveryMethod(order.dispatchDetails?.deliveryMethod || 'Clinic Messenger');
    setCourierRef(order.dispatchDetails?.courierReference || '');
    setDispatchNotes(order.dispatchDetails?.notes || '');
  };

  const submitDispatchUpdate = async (e) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;
    setBusyId(dispatchModalOrder.id);
    try {
      await laboratoryService.updateDispatchStatus(
        dispatchModalOrder.id,
        {
          subStatus: dispatchSubStatus,
          deliveryMethod,
          courierReference: courierRef,
          notes: dispatchNotes,
        },
        user
      );
      toast.success(
        `Updated ${dispatchModalOrder.requestCode}: ${DISPATCH_SUB_LABELS[dispatchSubStatus]} (awaiting clinic receipt confirmation)`
      );
      setDispatchModalOrder(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update dispatch tracking.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" className="h-28" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <Skeleton key={s} variant="card" className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" size="sm">
              Service-Specific Fabrication Pipeline
            </Badge>
            <span className="text-xs text-ink-secondary">
              Active Bench / Digital Cases: <strong>{inFabricationCount}</strong>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Laboratory Production Board
          </h2>
          <p className="text-sm text-ink-secondary">
            Real-time tracking across orthodontic retainers, digital &amp; conventional crowns/bridges, dentures, repairs, and custom workflows.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={ArrowLeft}
          onClick={() => navigate('/lab')}
        >
          Order Intake &amp; Admin {incomingCount > 0 ? `(${incomingCount} Incoming)` : ''}
        </Button>
      </div>

      {/* Incoming Prescriptions Banner */}
      {incomingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <strong>
                {incomingCount} incoming {incomingCount === 1 ? 'request is' : 'requests are'} waiting in Pending Review / Clarification!
              </strong>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Review prescriptions and accept them in Order Intake to assign a service workflow.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            rightIcon={ArrowRight}
            className="shrink-0"
            onClick={() => navigate('/lab')}
          >
            Open Intake Queue
          </Button>
        </div>
      )}

      {/* Workflow Selector Tabs (Wraps cleanly with zero horizontal scrollbar) */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {workflowTabs.map((tab) => {
            const active = selectedBoard === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedBoard(tab.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                  active
                    ? 'bg-teal-600 text-white border-teal-500 shadow-soft-sm'
                    : 'bg-surface-card text-ink-secondary border-surface-border hover:border-teal-500/50 hover:text-ink-primary'
                }`}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-subtle text-ink-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {selectedTemplate && (
          <div className="px-3.5 py-2 rounded-xl bg-surface-subtle border border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
            <div>
              <strong className="text-ink-primary">{selectedTemplate.name}:</strong>{' '}
              {selectedTemplate.description}
            </div>
            {selectedTemplate.supportsTryIn && (
              <Badge variant="primary" size="sm">
                Supports Chairside Clinic Try-In
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Production Board Columns — Full-Width Responsive Grid (Zero Horizontal Scrollbar) */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 ${
          boardColumns.length === 5
            ? 'lg:grid-cols-5'
            : boardColumns.length === 6
              ? 'lg:grid-cols-6'
              : boardColumns.length === 7
                ? 'lg:grid-cols-7'
                : 'lg:grid-cols-4'
        }`}
      >
        {boardColumns.map((col) => (
          <div
            key={col.key}
            className="flex flex-col rounded-2xl bg-surface-subtle border border-surface-border p-2.5 min-w-0"
          >
            {/* Column Header */}
            <div className="pb-2 border-b border-surface-border mb-2.5 min-w-0">
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span
                  className="text-[11px] xl:text-xs font-heading font-bold text-ink-primary truncate"
                  title={col.label}
                >
                  {col.label}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-300 shrink-0">
                  {col.orders.length}
                </span>
              </div>
              {col.desc && (
                <p className="text-[10px] text-ink-muted mt-0.5 line-clamp-2 leading-tight" title={col.desc}>
                  {col.desc}
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[680px] min-w-0">
              {col.orders.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-ink-muted italic">
                  No cases at this stage
                </div>
              ) : (
                col.orders.map((order) => {
                  const currentStageObj = (order.workflowStages || []).find(
                    (s) => s.key === order.productionStage
                  );
                  const nextStage = getNextProductionStage(order);
                  const retainerDetail =
                    order.workflowId === 'ORTHO_RETAINERS'
                      ? getRetainerFabricationDetail(order)
                      : null;

                  return (
                    <Card
                      key={order.id}
                      className={`p-2.5 space-y-2 bg-surface-card shadow-soft-sm hover:border-teal-400 transition-all min-w-0 overflow-hidden ${
                        order.priority === 'RUSH' || order.status === LAB_ORDER_STATUS.ISSUE_REPORTED
                          ? 'border-rose-400/70 dark:border-rose-500/50'
                          : 'border-surface-border'
                      }`}
                    >
                      {/* Request Code & Badges */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">
                          {order.requestCode}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
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
                      </div>

                      {/* Appliance & Workflow Tag */}
                      <div>
                        <div className="font-heading font-bold text-xs text-ink-primary leading-snug">
                          {order.applianceType}
                        </div>
                        <div className="text-[10px] text-ink-muted mt-0.5">
                          {order.workflowShortName}
                        </div>
                      </div>

                      {/* Status / Sub-status Banner */}
                      <div className="flex flex-wrap gap-1">
                        {order.status === LAB_ORDER_STATUS.ACCEPTED && (
                          <Badge
                            status={
                              order.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS
                                ? 'AWAITING_MATERIALS'
                                : 'READY_FOR_PRODUCTION'
                            }
                            size="sm"
                          >
                            {MATERIALS_DISPLAY_LABELS[order.materialsStatus] || 'Ready for Production'}
                          </Badge>
                        )}
                        {order.status === LAB_ORDER_STATUS.IN_PRODUCTION && currentStageObj && (
                          <Badge status="IN_PRODUCTION" size="sm">
                            {currentStageObj.label}
                          </Badge>
                        )}
                        {order.tryInStatus === 'SENT_TO_CLINIC' && (
                          <Badge status="SENT_TO_CLINIC" size="sm">
                            At Clinic • Try-In
                          </Badge>
                        )}
                        {order.status === LAB_ORDER_STATUS.QUALITY_CHECK && (
                          <Badge status="QUALITY_CHECK" size="sm">
                            Quality Check
                          </Badge>
                        )}
                        {[LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(
                          order.status
                        ) && (
                          <Badge
                            status={order.dispatchSubStatus || order.status}
                            size="sm"
                          >
                            {DISPATCH_SUB_LABELS[order.dispatchSubStatus] ||
                              STATUS_DISPLAY_LABELS[order.status]}
                          </Badge>
                        )}
                        {order.status === LAB_ORDER_STATUS.ISSUE_REPORTED && (
                          <Badge status="ISSUE_REPORTED" size="sm">
                            Clinic Issue Reported
                          </Badge>
                        )}
                      </div>

                      {/* Privacy-Safe Case Metadata */}
                      <div className="space-y-1 text-[11px] text-ink-secondary pt-0.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1 min-w-0">
                          <span className="font-semibold text-ink-primary truncate">
                            {order.caseReference}
                          </span>
                          <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono truncate">
                            {formatArchAndTeeth(order)}
                          </span>
                        </div>
                        <div className="text-[10px] text-ink-secondary truncate">
                          {order.material}
                          {order.shade ? ` • Shade ${order.shade}` : ''}
                        </div>
                        <div className="text-[10px] text-ink-muted truncate">
                          Dr. {order.dentistName} • {order.clinicName}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-ink-muted">
                          <span className="inline-flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 shrink-0" />
                            Due:{' '}
                            {order.estimatedCompletionDate
                              ? formatDate(order.estimatedCompletionDate)
                              : 'TBD'}
                          </span>
                          {order.assignedTech && (
                            <span className="text-purple-600 dark:text-purple-400 font-medium truncate max-w-full">
                              {order.assignedTech}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Retainer Subtype Fabrication Guidance */}
                      {retainerDetail && order.status === LAB_ORDER_STATUS.IN_PRODUCTION && (
                        <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-800 dark:text-teal-200 leading-relaxed break-words">
                          <Wrench className="w-3 h-3 inline mr-1" />
                          {retainerDetail}
                        </div>
                      )}

                      {/* Reported Issue Summary */}
                      {order.status === LAB_ORDER_STATUS.ISSUE_REPORTED && order.issueReport && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-800 dark:text-rose-200 break-words">
                          <strong>{order.issueReport.issueType}:</strong> {order.issueReport.description}
                        </div>
                      )}

                      {/* Stage-Appropriate Actions */}
                      <div className="pt-2 border-t border-surface-border space-y-1.5 min-w-0">
                        {order.status === LAB_ORDER_STATUS.ACCEPTED &&
                          order.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-[11px] px-2"
                              leftIcon={PackageCheck}
                              isLoading={busyId === order.id}
                              onClick={() => handleConfirmMaterials(order)}
                            >
                              Confirm Materials
                            </Button>
                          )}

                        {order.status === LAB_ORDER_STATUS.ACCEPTED &&
                          order.materialsStatus === MATERIALS_STATUS.READY_FOR_PRODUCTION && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="w-full text-[11px] px-2"
                              leftIcon={Play}
                              isLoading={busyId === order.id}
                              onClick={() => openStartProduction(order)}
                            >
                              Start Fabrication
                            </Button>
                          )}

                        {order.status === LAB_ORDER_STATUS.IN_PRODUCTION &&
                          order.tryInStatus !== 'SENT_TO_CLINIC' &&
                          nextStage &&
                          nextStage.phase !== 'DISPATCH' && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="w-full text-[11px] px-2"
                              rightIcon={ArrowRight}
                              isLoading={busyId === order.id}
                              onClick={() => openAdvanceStage(order, nextStage)}
                            >
                              {nextStage.phase === 'QUALITY_CHECK'
                                ? 'Quality Check'
                                : `Next: ${nextStage.label}`}
                            </Button>
                          )}

                        {order.status === LAB_ORDER_STATUS.IN_PRODUCTION &&
                          order.tryInStatus === 'SENT_TO_CLINIC' && (
                            <div className="text-[10px] text-center py-1 px-1.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium">
                              At Clinic • Try-In
                            </div>
                          )}

                        {order.status === LAB_ORDER_STATUS.QUALITY_CHECK && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="w-full text-[11px] px-2"
                            leftIcon={ShieldCheck}
                            isLoading={busyId === order.id}
                            onClick={() => openQualityCheck(order)}
                          >
                            Verify QC
                          </Button>
                        )}

                        {[LAB_ORDER_STATUS.READY_FOR_DISPATCH, LAB_ORDER_STATUS.DISPATCHED].includes(
                          order.status
                        ) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full text-[11px] px-2"
                            leftIcon={Truck}
                            isLoading={busyId === order.id}
                            onClick={() => openDispatchModal(order)}
                          >
                            {order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH
                              ? 'Record Dispatch'
                              : 'Dispatch Ref'}
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-[11px] px-2"
                          leftIcon={Eye}
                          onClick={() => navigate(`/lab/requests/${order.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal 1: Start Fabrication */}
      <Modal
        isOpen={Boolean(startModalOrder)}
        onClose={() => setStartModalOrder(null)}
        exitImmediately
        title="Start Service-Specific Fabrication"
        maxWidth="max-w-lg"
      >
        {startModalOrder && (
          <form onSubmit={submitStartProduction} className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs space-y-1">
              <div className="font-bold text-ink-primary">
                {startModalOrder.requestCode} — {startModalOrder.applianceType}
              </div>
              <div className="text-ink-secondary">
                Workflow: <strong>{startModalOrder.workflowName}</strong>
              </div>
            </div>

            <Input
              label="Assigned Laboratory Technician"
              value={startTech}
              onChange={(e) => setStartTech(e.target.value)}
              placeholder="e.g., Master Tech R. Santos"
              required
            />

            <Input
              label="Initial Bench / Setup Note (Optional)"
              value={startNote}
              onChange={(e) => setStartNote(e.target.value)}
              placeholder="e.g., Articulated cast verified, starting Stage 1"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setStartModalOrder(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={busyId === startModalOrder.id}>
                Begin Production
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 2: Advance Fabrication Stage */}
      <Modal
        isOpen={Boolean(stageModalData)}
        onClose={() => setStageModalData(null)}
        exitImmediately
        title="Advance Production Stage"
        maxWidth="max-w-lg"
      >
        {stageModalData && (
          <form onSubmit={submitAdvanceStage} className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs space-y-1">
              <div className="font-bold text-ink-primary">
                {stageModalData.order.requestCode} — {stageModalData.order.applianceType}
              </div>
              <div className="text-ink-secondary">
                Target Stage: <strong>{stageModalData.nextStage.label}</strong>
              </div>
            </div>

            {stageModalData.nextStage.isTryInStage && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-ink-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendForTryIn}
                  onChange={(e) => setSendForTryIn(e.target.checked)}
                  className="mt-0.5 rounded border-surface-border text-teal-600 focus:ring-teal-500"
                />
                <span>
                  <strong>Send to Clinic for Chairside Try-In / Approval</strong>
                  <span className="block text-ink-secondary mt-0.5">
                    Pauses final processing until the dentist evaluates occlusion/esthetics and approves continuation.
                  </span>
                </span>
              </label>
            )}

            <Input
              label="Stage Progress Note (Visible on Timeline)"
              value={stageProgressNote}
              onChange={(e) => setStageProgressNote(e.target.value)}
              placeholder="Optional fabrication update for this milestone..."
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setStageModalData(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={busyId === stageModalData.order.id}>
                Confirm Stage Transition
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Quality Check Verification Gate */}
      <Modal
        isOpen={Boolean(qcModalOrder)}
        onClose={() => setQcModalOrder(null)}
        exitImmediately
        title="Laboratory Quality Check Verification"
        maxWidth="max-w-lg"
      >
        {qcModalOrder && (
          <form onSubmit={submitQualityCheck} className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
              <strong>Clinical Disclaimer:</strong> Laboratory Quality Check verifies prescription compliance and bench workmanship; it does not replace clinical evaluation or chairside fitting by the attending dentist.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQcDecision('PASS')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  qcDecision === 'PASS'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : 'bg-surface-subtle border-surface-border text-ink-secondary'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Pass Quality Check
              </button>
              <button
                type="button"
                onClick={() => setQcDecision('FAIL')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  qcDecision === 'FAIL'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                    : 'bg-surface-subtle border-surface-border text-ink-secondary'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Fail &amp; Return to Bench
              </button>
            </div>

            {qcDecision === 'PASS' ? (
              <div className="space-y-2 p-3 rounded-xl bg-surface-subtle border border-surface-border">
                {[
                  ['applianceVerified', `Requested appliance verified (${qcModalOrder.applianceType})`],
                  ['materialVerified', `Material & shade verified (${qcModalOrder.material} • ${qcModalOrder.shade || 'Standard'})`],
                  ['toothOrArchVerified', `Tooth number / dental arch verified (${formatArchAndTeeth(qcModalOrder)})`],
                  ['workmanshipVerified', 'Margins, retention, occlusion, and surface polish inspected'],
                  ['prescriptionMatched', 'Special dentist prescription instructions satisfied'],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-xs text-ink-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(qcChecklist[field])}
                      onChange={(e) =>
                        setQcChecklist((prev) => ({ ...prev, [field]: e.target.checked }))
                      }
                      className="rounded border-surface-border text-teal-600 focus:ring-teal-500"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <Select
                label="Return to Fabrication Step"
                placeholder=""
                value={qcReturnStage}
                onChange={(e) => setQcReturnStage(e.target.value)}
                options={(qcModalOrder.workflowStages || [])
                  .filter((s) => s.phase === 'PRODUCTION')
                  .map((s) => ({ value: s.key, label: s.label }))}
              />
            )}

            <Input
              label={qcDecision === 'PASS' ? 'QC Remarks (Optional)' : 'Failure Reason (Required)'}
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder={
                qcDecision === 'PASS'
                  ? 'e.g., Fit and shade verified on master cast'
                  : 'Document discrepancy requiring rework...'
              }
              required={qcDecision === 'FAIL'}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setQcModalOrder(null)}>
                Cancel
              </Button>
              <Button
                variant={qcDecision === 'PASS' ? 'primary' : 'danger'}
                type="submit"
                isLoading={busyId === qcModalOrder.id}
              >
                {qcDecision === 'PASS' ? 'Approve → Ready for Pickup/Dispatch' : 'Return to Fabrication'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 4: Ready for Pickup / Dispatch Recording */}
      <Modal
        isOpen={Boolean(dispatchModalOrder)}
        onClose={() => setDispatchModalOrder(null)}
        exitImmediately
        title="Record Pickup Readiness or Clinic Dispatch"
        maxWidth="max-w-lg"
      >
        {dispatchModalOrder && (
          <form onSubmit={submitDispatchUpdate} className="space-y-4">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-900 dark:text-sky-200">
              Dispatching notifies the clinic but <strong>never</strong> automatically marks the request Completed. Only authorized clinic personnel can confirm physical receipt.
            </div>

            <Select
              label="Delivery / Dispatch Status"
              placeholder=""
              value={dispatchSubStatus}
              onChange={(e) => setDispatchSubStatus(e.target.value)}
              options={[
                { value: DISPATCH_SUB_STATUS.READY_FOR_PICKUP, label: 'Ready for Clinic Pickup' },
                { value: DISPATCH_SUB_STATUS.IN_TRANSIT, label: 'Dispatched / In Transit' },
                { value: DISPATCH_SUB_STATUS.AWAITING_CLINIC_RECEIPT, label: 'Delivered to Front Desk • Awaiting Clinic Receipt' },
              ]}
            />

            <Select
              label="Delivery Method"
              placeholder=""
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              options={[
                { value: 'Clinic Messenger', label: 'In-House Clinic Messenger' },
                { value: 'Clinic Staff Pickup', label: 'Clinic Staff Direct Pickup' },
                { value: 'Medical Courier', label: 'External Medical Courier' },
              ]}
            />

            <Input
              label="Courier / Pickup Reference (If Applicable)"
              value={courierRef}
              onChange={(e) => setCourierRef(e.target.value)}
              placeholder="e.g., Waybill #SG-8841 or Messenger Name"
            />

            <Input
              label="Dispatch / Packaging Notes"
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="e.g., Hydrated in sealed pouch with bite registration"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setDispatchModalOrder(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={busyId === dispatchModalOrder.id}>
                Save Dispatch Status
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
export default LabOrdersQueue;
