import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Inbox,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ArrowRight,
  Truck,
  Package,
  SlidersHorizontal,
  Settings2,
  Eye,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { authService } from '../../services/authService';
import { ROLES } from '../../lib/roles';
import {
  LAB_ORDER_STATUS,
  STATUS_DISPLAY_LABELS,
  MATERIALS_STATUS,
  MATERIALS_DISPLAY_LABELS,
  DISPATCH_SUB_LABELS,
  APPLIANCE_CATEGORIES,
  APPLIANCE_CATEGORY_LABELS,
  formatArchAndTeeth,
} from '../../lib/labWorkflows';
import { formatDate } from '../../lib/formatters';
import { StatCard } from '../../components/charts/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/Skeleton';

function toDateYMD(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function LabIntakePage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [workflowsMap, setWorkflowsMap] = useState({});
  const [labStaff, setLabStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tabs & Filters (Phase 4)
  const [activeTab, setActiveTab] = useState('INCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [techFilter, setTechFilter] = useState('ALL');
  const [requestedDateFilter, setRequestedDateFilter] = useState('');
  const [expectedDateFilter, setExpectedDateFilter] = useState('');

  // Quick Intake Modals
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [acceptMaterialsReady, setAcceptMaterialsReady] = useState(true);
  const [acceptWorkflowId, setAcceptWorkflowId] = useState('');
  const [acceptEstDate, setAcceptEstDate] = useState('');
  const [acceptTech, setAcceptTech] = useState('');
  const [acceptNotes, setAcceptNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reasonModal, setReasonModal] = useState(null); // { order, mode: 'CLARIFY' | 'DECLINE' }
  const [reasonInput, setReasonInput] = useState('');

  // Configurable Workflow Template Manager (Workflow E — Phase 3)
  const [isWorkflowMgrOpen, setIsWorkflowMgrOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState('OTHER_CUSTOM');
  const [tplName, setTplName] = useState('');
  const [tplShortName, setTplShortName] = useState('');
  const [tplCategory, setTplCategory] = useState(APPLIANCE_CATEGORIES.OTHER);
  const [tplSupportsTryIn, setTplSupportsTryIn] = useState(false);
  const [tplSteps, setTplSteps] = useState([
    'Case Preparation',
    'Appliance Fabrication',
    'Finishing & Conditioning',
  ]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubOrders = laboratoryService.subscribeToOrders((liveOrders) => {
      setOrders(liveOrders);
      setLoading(false);
    }, user);

    const unsubWorkflows = laboratoryService.subscribeWorkflowTemplates((map) => {
      setWorkflowsMap(map);
    });

    const unsubUsers = authService.subscribeToUsers((allUsers) => {
      setLabStaff(allUsers.filter((u) => u.role === ROLES.LAB_TECH && !u.deactivated));
    });

    return () => {
      unsubOrders();
      unsubWorkflows();
      unsubUsers();
    };
  }, [user?.id, user?.role]);

  // Phase 4 — 6 Accurate Database Counts
  const dashboardCounts = useMemo(() => {
    const pendingReview = orders.filter(
      (o) =>
        o.status === LAB_ORDER_STATUS.PENDING_REVIEW ||
        o.status === LAB_ORDER_STATUS.CLARIFICATION_REQUESTED
    ).length;

    const awaitingMaterials = orders.filter(
      (o) =>
        o.status === LAB_ORDER_STATUS.ACCEPTED &&
        o.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS
    ).length;

    const acceptedTotal = orders.filter(
      (o) => o.status === LAB_ORDER_STATUS.ACCEPTED
    ).length;

    const inProduction = orders.filter((o) =>
      [
        LAB_ORDER_STATUS.IN_PRODUCTION,
        LAB_ORDER_STATUS.QUALITY_CHECK,
        LAB_ORDER_STATUS.ISSUE_REPORTED,
      ].includes(o.status)
    ).length;

    const readyOrDispatched = orders.filter(
      (o) =>
        o.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH ||
        o.status === LAB_ORDER_STATUS.DISPATCHED
    ).length;

    const overdue = orders.filter((o) => o.isOverdue).length;

    const completed = orders.filter(
      (o) => o.status === LAB_ORDER_STATUS.COMPLETED
    ).length;

    return {
      pendingReview,
      awaitingMaterials,
      acceptedTotal,
      inProduction,
      readyOrDispatched,
      overdue,
      completed,
      total: orders.length,
    };
  }, [orders]);

  // Unique technicians for filter dropdown
  const technicianOptions = useMemo(() => {
    const names = new Set();
    labStaff.forEach((s) => {
      if (s.fullName) names.add(s.fullName);
    });
    orders.forEach((o) => {
      if (o.assignedTech) names.add(o.assignedTech);
    });
    return Array.from(names);
  }, [labStaff, orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab gate
      if (
        activeTab === 'INCOMING' &&
        o.status !== LAB_ORDER_STATUS.PENDING_REVIEW &&
        o.status !== LAB_ORDER_STATUS.CLARIFICATION_REQUESTED
      ) {
        return false;
      }
      if (activeTab === 'ACCEPTED' && o.status !== LAB_ORDER_STATUS.ACCEPTED) {
        return false;
      }
      if (
        activeTab === 'IN_PRODUCTION' &&
        ![
          LAB_ORDER_STATUS.IN_PRODUCTION,
          LAB_ORDER_STATUS.QUALITY_CHECK,
          LAB_ORDER_STATUS.ISSUE_REPORTED,
        ].includes(o.status)
      ) {
        return false;
      }
      if (
        activeTab === 'READY_DISPATCHED' &&
        o.status !== LAB_ORDER_STATUS.READY_FOR_DISPATCH &&
        o.status !== LAB_ORDER_STATUS.DISPATCHED
      ) {
        return false;
      }
      if (activeTab === 'COMPLETED' && o.status !== LAB_ORDER_STATUS.COMPLETED) {
        return false;
      }

      // Explicit Filters
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && o.category !== categoryFilter) return false;
      if (priorityFilter !== 'ALL' && (o.priority || 'STANDARD') !== priorityFilter) return false;
      if (techFilter !== 'ALL') {
        if (techFilter === 'UNASSIGNED' && o.assignedTech) return false;
        if (techFilter !== 'UNASSIGNED' && o.assignedTech !== techFilter) return false;
      }
      if (requestedDateFilter && toDateYMD(o.createdAt) !== requestedDateFilter) return false;
      if (expectedDateFilter && toDateYMD(o.estimatedCompletionDate) !== expectedDateFilter) {
        return false;
      }

      // Search across Request ID, Appliance Name, Dentist/Clinic, and Case Reference
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          o.id,
          o.requestCode,
          o.caseReference,
          o.applianceType,
          o.clinicName,
          o.dentistName,
          o.material,
          ...(o.toothNumbers || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    orders,
    activeTab,
    statusFilter,
    categoryFilter,
    priorityFilter,
    techFilter,
    requestedDateFilter,
    expectedDateFilter,
    searchQuery,
  ]);

  const clearAllFilters = () => {
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setPriorityFilter('ALL');
    setTechFilter('ALL');
    setRequestedDateFilter('');
    setExpectedDateFilter('');
    setSearchQuery('');
  };

  const openQuickAccept = (order) => {
    const fallbackDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    setAcceptTarget(order);
    setAcceptMaterialsReady(!order.requiresPhysicalMaterials);
    setAcceptWorkflowId(order.workflowId);
    setAcceptEstDate(order.estimatedCompletionDate || fallbackDate);
    setAcceptTech(order.assignedTech || user?.fullName || labStaff[0]?.fullName || '');
    setAcceptNotes('');
  };

  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!acceptTarget) return;
    setIsSubmitting(true);
    try {
      await laboratoryService.acceptOrder(
        acceptTarget.id,
        {
          materialsAvailable: acceptMaterialsReady,
          workflowId: acceptWorkflowId,
          estimatedCompletionDate: acceptEstDate,
          assignedTech: acceptTech,
          labNotes: acceptNotes,
        },
        user
      );
      toast.success(
        `Accepted ${acceptTarget.requestCode} (${acceptMaterialsReady ? 'Ready for Production' : 'Awaiting Materials'
        }).`
      );
      setAcceptTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to accept request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReason = async (e) => {
    e.preventDefault();
    if (!reasonModal) return;
    setIsSubmitting(true);
    try {
      if (reasonModal.mode === 'CLARIFY') {
        await laboratoryService.requestClarification(
          reasonModal.order.id,
          reasonInput,
          user
        );
        toast.info(`Clarification requested on ${reasonModal.order.requestCode}.`);
      } else {
        await laboratoryService.declineRequest(
          reasonModal.order.id,
          reasonInput,
          user
        );
        toast.info(`Declined ${reasonModal.order.requestCode}.`);
      }
      setReasonModal(null);
      setReasonInput('');
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickConfirmMaterials = async (order) => {
    try {
      await laboratoryService.confirmMaterialsReceived(
        order.id,
        { conditionNote: 'Physical cast / impression verified at intake' },
        user
      );
      toast.success(`${order.requestCode} marked Ready for Production.`);
    } catch (err) {
      toast.error(err.message || 'Could not confirm materials.');
    }
  };

  const handleQuickStartProduction = async (order) => {
    try {
      await laboratoryService.startProduction(
        order.id,
        {
          workflowId: order.workflowId,
          assignedTech: order.assignedTech || user?.fullName || 'Lab Specialist',
        },
        user
      );
      toast.success(`${order.requestCode} moved to In Production (${order.workflowShortName}).`);
    } catch (err) {
      toast.error(err.message || 'Could not start production.');
    }
  };

  // Load selected template into Workflow Configurator Modal
  const loadTemplateIntoEditor = (tplId) => {
    setEditingTemplateId(tplId);
    if (tplId === 'NEW_CUSTOM') {
      setTplName('');
      setTplShortName('');
      setTplCategory(APPLIANCE_CATEGORIES.OTHER);
      setTplSupportsTryIn(false);
      setTplSteps(['Case Preparation', 'Custom Fabrication', 'Finishing']);
      return;
    }
    const existing = workflowsMap[tplId];
    if (existing) {
      setTplName(existing.name || '');
      setTplShortName(existing.shortName || '');
      setTplCategory(existing.category || APPLIANCE_CATEGORIES.OTHER);
      setTplSupportsTryIn(Boolean(existing.supportsTryIn));
      const prodSteps = (existing.stages || [])
        .filter((s) => s.phase === 'PRODUCTION')
        .map((s) => s.label);
      setTplSteps(prodSteps.length > 0 ? prodSteps : ['Case Preparation', 'Fabrication']);
    }
  };

  const handleSaveWorkflowTemplate = async (e) => {
    e.preventDefault();
    setIsSavingTemplate(true);
    try {
      await laboratoryService.saveWorkflowTemplate(
        {
          id: editingTemplateId === 'NEW_CUSTOM' ? '' : editingTemplateId,
          name: tplName,
          shortName: tplShortName || tplName,
          category: tplCategory,
          supportsTryIn: tplSupportsTryIn,
          productionStepLabels: tplSteps,
        },
        user
      );
      toast.success('Workflow template saved to database!');
      setIsWorkflowMgrOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save workflow template.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const tabs = [
    { id: 'INCOMING', label: 'Incoming Requests', badge: dashboardCounts.pendingReview },
    { id: 'ACCEPTED', label: 'Accepted', badge: dashboardCounts.acceptedTotal },
    { id: 'IN_PRODUCTION', label: 'In Production', badge: dashboardCounts.inProduction },
    { id: 'READY_DISPATCHED', label: 'Ready / Dispatched', badge: dashboardCounts.readyOrDispatched },
    { id: 'COMPLETED', label: 'Completed', badge: dashboardCounts.completed },
    { id: 'ALL', label: 'All Requests', badge: dashboardCounts.total },
  ];

  const activeFilterCount = [
    statusFilter !== 'ALL',
    categoryFilter !== 'ALL',
    priorityFilter !== 'ALL',
    techFilter !== 'ALL',
    Boolean(requestedDateFilter),
    Boolean(expectedDateFilter),
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-soft-lg border border-teal-500/20">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SmileGuard Dental Laboratory
            </span>
            {dashboardCounts.overdue > 0 && (
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500 text-white">
                {dashboardCounts.overdue} Overdue
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
            Laboratory Order Intake &amp; Admin
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Manage incoming prescriptions, material intake, service-specific fabrication assignments, quality verification, and clinic dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Settings2}
            onClick={() => {
              loadTemplateIntoEditor('OTHER_CUSTOM');
              setIsWorkflowMgrOpen(true);
            }}
            className="bg-white/10 hover:bg-white/20 text-white border-white/15"
          >
            Workflow Templates
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            rightIcon={ArrowRight}
            onClick={() => navigate('/lab/board')}
            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
          >
            Laboratory Production Board
          </Button>
        </div>
      </div>

      {/* Phase 4 — 6 Live Database Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Pending Review"
          value={dashboardCounts.pendingReview}
          subtitle="Incoming & clarifications"
          icon={Inbox}
          color="orange"
        />
        <StatCard
          title="Awaiting Materials"
          value={dashboardCounts.awaitingMaterials}
          subtitle="Physical cast / impression"
          icon={Package}
          color="purple"
        />
        <StatCard
          title="In Production"
          value={dashboardCounts.inProduction}
          subtitle="Active fabrication & QC"
          icon={FlaskConical}
          color="teal"
        />
        <StatCard
          title="Ready / Dispatch"
          value={dashboardCounts.readyOrDispatched}
          subtitle="Pickup or in-transit"
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Overdue Requests"
          value={dashboardCounts.overdue}
          subtitle="Past expected due date"
          icon={AlertTriangle}
          color="orange"
        />
        <StatCard
          title="Completed"
          value={dashboardCounts.completed}
          subtitle="Confirmed by clinic"
          icon={CheckCircle2}
          color="teal"
        />
      </div>

      {/* Request Tabs + Search + Multi-Filter Drawer */}
      <div className="space-y-4">
        <div className="space-y-3">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="w-full min-w-0 flex-nowrap overflow-x-auto"
          />

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-72 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search Request ID, Case Ref, Appliance..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-card border border-surface-border text-ink-primary placeholder:text-ink-muted outline-none focus:border-teal-500"
              />
            </div>

            <Button
              variant={showFilters || activeFilterCount > 0 ? 'primary' : 'outline'}
              size="sm"
              leftIcon={SlidersHorizontal}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" leftIcon={RotateCcw} onClick={clearAllFilters}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Expandable 6-Criteria Filter Panel */}
        {showFilters && (
          <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                ...Object.entries(STATUS_DISPLAY_LABELS).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />

            <Select
              label="Appliance Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                ...Object.entries(APPLIANCE_CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />

            <Select
              label="Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'RUSH', label: 'Rush Priority' },
                { value: 'STANDARD', label: 'Standard' },
              ]}
            />

            <Select
              label="Assigned Technician"
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Technicians' },
                { value: 'UNASSIGNED', label: 'Unassigned' },
                ...technicianOptions.map((t) => ({ value: t, label: t })),
              ]}
            />

            <Input
              label="Date Requested"
              type="date"
              value={requestedDateFilter}
              onChange={(e) => setRequestedDateFilter(e.target.value)}
            />

            <Input
              label="Expected Completion"
              type="date"
              value={expectedDateFilter}
              onChange={(e) => setExpectedDateFilter(e.target.value)}
            />
          </Card>
        )}

        {/* Privacy-Safe Request Overview Cards / Table */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title="No Laboratory Requests Match This View"
            description="New prescriptions submitted by clinic dentists appear automatically in Incoming Requests."
            icon={Inbox}
            actionLabel={activeFilterCount > 0 ? 'Clear Active Filters' : undefined}
            onAction={activeFilterCount > 0 ? clearAllFilters : undefined}
          />
        ) : (
          <Card className="overflow-hidden shadow-soft-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="p-4 pl-6">Request ID &amp; Case Ref</th>
                    <th className="p-4">Clinic / Dentist</th>
                    <th className="p-4">Appliance &amp; Arch / Teeth</th>
                    <th className="p-4">Dates (Requested / Due)</th>
                    <th className="p-4">Priority &amp; Status</th>
                    <th className="p-4">Technician</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/60 text-xs">
                  {filteredOrders.map((order) => {
                    const currentStageObj = (order.workflowStages || []).find(
                      (s) => s.key === order.productionStage
                    );

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                      >
                        <td className="p-4 pl-6">
                          <p className="font-mono font-extrabold text-ink-primary">
                            {order.requestCode}
                          </p>
                          <p className="font-mono text-[11px] text-teal-700 dark:text-teal-400">
                            {order.caseReference}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="font-bold text-ink-primary">Dr. {order.dentistName}</p>
                          <p className="text-[11px] text-ink-muted">{order.clinicName}</p>
                        </td>

                        <td className="p-4">
                          <p className="font-bold text-ink-primary">{order.applianceType}</p>
                          <p className="text-[11px] text-ink-secondary">
                            {formatArchAndTeeth(order)} • {order.workflowShortName}
                          </p>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <p className="text-[11px] text-ink-muted">
                            Req: {formatDate(order.createdAt)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-ink-primary">
                              Due: {formatDate(order.estimatedCompletionDate)}
                            </span>
                            {order.isOverdue && (
                              <Badge variant="danger" size="sm">
                                OVERDUE
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {order.priority === 'RUSH' ? (
                              <Badge variant="danger" size="sm">
                                RUSH
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                STANDARD
                              </Badge>
                            )}

                            <Badge status={order.status} size="sm" showDot>
                              {STATUS_DISPLAY_LABELS[order.status] || order.status}
                            </Badge>
                          </div>

                          {order.status === LAB_ORDER_STATUS.ACCEPTED && order.materialsStatus && (
                            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 mt-1">
                              {MATERIALS_DISPLAY_LABELS[order.materialsStatus]}
                            </p>
                          )}

                          {order.status === LAB_ORDER_STATUS.IN_PRODUCTION && currentStageObj && (
                            <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-1">
                              Stage: {currentStageObj.label}
                              {order.tryInStatus === 'SENT_TO_CLINIC' ? ' (Try-In at Clinic)' : ''}
                            </p>
                          )}

                          {(order.status === LAB_ORDER_STATUS.READY_FOR_DISPATCH ||
                            order.status === LAB_ORDER_STATUS.DISPATCHED) &&
                            order.dispatchSubStatus && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mt-1">
                                {DISPATCH_SUB_LABELS[order.dispatchSubStatus] || order.dispatchSubStatus}
                              </p>
                            )}
                        </td>

                        <td className="p-4">
                          <span className="font-semibold text-ink-primary">
                            {order.assignedTech || 'Unassigned'}
                          </span>
                        </td>

                        <td className="p-4 pr-6 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {order.status === LAB_ORDER_STATUS.PENDING_REVIEW && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openQuickAccept(order)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setReasonInput('');
                                    setReasonModal({ order, mode: 'CLARIFY' });
                                  }}
                                >
                                  Clarify
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600"
                                  onClick={() => {
                                    setReasonInput('');
                                    setReasonModal({ order, mode: 'DECLINE' });
                                  }}
                                >
                                  Decline
                                </Button>
                              </>
                            )}

                            {order.status === LAB_ORDER_STATUS.ACCEPTED &&
                              order.materialsStatus === MATERIALS_STATUS.AWAITING_MATERIALS && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleQuickConfirmMaterials(order)}
                                >
                                  Confirm Materials
                                </Button>
                              )}

                            {order.status === LAB_ORDER_STATUS.ACCEPTED &&
                              order.materialsStatus === MATERIALS_STATUS.READY_FOR_PRODUCTION && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleQuickStartProduction(order)}
                                >
                                  Start Production
                                </Button>
                              )}

                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={Eye}
                              onClick={() => navigate(`/lab/requests/${order.id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Quick Accept Request Modal */}
      <Modal
        isOpen={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        title="Accept Laboratory Request"
        description={
          acceptTarget ? `${acceptTarget.requestCode} • ${acceptTarget.applianceType}` : ''
        }
      >
        {acceptTarget && (
          <form onSubmit={handleConfirmAccept} className="space-y-4">
            <Select
              label="Service Production Workflow"
              value={acceptWorkflowId}
              onChange={(e) => setAcceptWorkflowId(e.target.value)}
              options={Object.values(workflowsMap).map((w) => ({
                value: w.id,
                label: w.name,
              }))}
            />

            <Select
              label="Material & Input Availability"
              value={acceptMaterialsReady ? 'READY' : 'AWAITING'}
              onChange={(e) => setAcceptMaterialsReady(e.target.value === 'READY')}
              options={[
                {
                  value: 'READY',
                  label: 'Ready for Production (Digital Scan / Inputs Present)',
                },
                {
                  value: 'AWAITING',
                  label: 'Awaiting Materials (Physical Impression / Stone Cast En Route)',
                },
              ]}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Assign Technician"
                value={acceptTech}
                onChange={(e) => setAcceptTech(e.target.value)}
                placeholder="Technician name"
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
              label="Intake Notes (Optional)"
              value={acceptNotes}
              onChange={(e) => setAcceptNotes(e.target.value)}
              placeholder="e.g. Digital margin verified complete"
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setAcceptTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Accept Request
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Quick Clarify / Decline Modal */}
      <Modal
        isOpen={Boolean(reasonModal)}
        onClose={() => setReasonModal(null)}
        title={
          reasonModal?.mode === 'DECLINE'
            ? 'Decline Laboratory Request (Reason Required)'
            : 'Request Prescription Clarification'
        }
        description={
          reasonModal ? `${reasonModal.order.requestCode} • Dr. ${reasonModal.order.dentistName}` : ''
        }
      >
        <form onSubmit={handleConfirmReason} className="space-y-4">
          <textarea
            rows={4}
            required
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder={
              reasonModal?.mode === 'DECLINE'
                ? 'Document why this laboratory request is being declined (required)...'
                : 'Specify what clinical details, shade, arch, or scan files are required...'
            }
            className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setReasonModal(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={reasonModal?.mode === 'DECLINE' ? 'danger' : 'primary'}
              isLoading={isSubmitting}
            >
              {reasonModal?.mode === 'DECLINE' ? 'Decline Request' : 'Send Clarification'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Workflow E — Configurable Service Workflow Template Manager Modal */}
      <Modal
        isOpen={isWorkflowMgrOpen}
        onClose={() => setIsWorkflowMgrOpen(false)}
        title="Configure Service Production Workflows"
        description="Customize Workflow E or create custom appliance production stage templates without code changes."
      >
        <form onSubmit={handleSaveWorkflowTemplate} className="space-y-4 text-xs">
          <Select
            label="Select Template to Customize or Create New"
            value={editingTemplateId}
            onChange={(e) => loadTemplateIntoEditor(e.target.value)}
            options={[
              ...Object.values(workflowsMap).map((w) => ({
                value: w.id,
                label: w.name,
              })),
              { value: 'NEW_CUSTOM', label: '+ Create New Custom Workflow Template' },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Workflow Full Name"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="e.g. Clear Aligner Series Workflow"
              required
            />
            <Input
              label="Short Board Label"
              value={tplShortName}
              onChange={(e) => setTplShortName(e.target.value)}
              placeholder="e.g. Clear Aligners"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <Select
              label="Appliance Category"
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              options={Object.entries(APPLIANCE_CATEGORY_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-subtle border border-surface-border cursor-pointer font-semibold text-ink-primary">
              <input
                type="checkbox"
                checked={tplSupportsTryIn}
                onChange={(e) => setTplSupportsTryIn(e.target.checked)}
              />
              <span>Supports Clinic Try-In Step</span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold uppercase tracking-wider text-[10px] text-ink-muted">
                Fabrication Stages (Followed automatically by Quality Check &amp; Ready for Dispatch)
              </p>
              <button
                type="button"
                onClick={() => setTplSteps((prev) => [...prev, `Fabrication Step ${prev.length + 1}`])}
                className="text-teal-600 dark:text-teal-400 font-bold inline-flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Stage
              </button>
            </div>

            {tplSteps.map((stepVal, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-ink-muted w-5">{idx + 1}.</span>
                <input
                  type="text"
                  required
                  value={stepVal}
                  onChange={(e) =>
                    setTplSteps((prev) =>
                      prev.map((v, i) => (i === idx ? e.target.value : v))
                    )
                  }
                  className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-1.5 text-xs outline-none focus:border-teal-500"
                />
                {tplSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTplSteps((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
            <Button type="button" variant="ghost" onClick={() => setIsWorkflowMgrOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingTemplate}>
              Save Workflow Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
