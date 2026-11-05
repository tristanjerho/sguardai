import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  User,
  Stethoscope,
  Calendar,
  FileText,
  ExternalLink,
  Image as ImageIcon,
  ArrowRight,
  Zap,
  RotateCcw,
  Truck,
  Printer,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { authService } from '../../services/authService';
import { ROLES } from '../../lib/roles';
import { LAB_ORDER_STATUS, LAB_ORDER_STAGES } from '../../lib/constants';
import { formatDate, formatDateTime, formatRelativeTime } from '../../lib/formatters';
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

const REVISION_TEMPLATES = [
  'Unclear preparation margin — please upload clearer scan or impression',
  'Missing opposing arch / bite registration record',
  'Please confirm Vita shade and translucency specification',
  'Insufficient occlusal clearance for requested material',
];

const STATUS_LABELS = {
  PENDING_REVIEW: 'Awaiting Lab Intake',
  REVISION_NEEDED: 'Returned to Dentist',
  RECEIVED: 'Received (Intake)',
  DESIGN: 'CAD 3D Design',
  MILLING: 'CAM Milling / Print',
  GLAZING: 'Sintering & Glazing',
  QA: 'Quality Assurance',
  DISPATCHED: 'Dispatched to Clinic',
  COMPLETED: 'Fitted & Completed',
};

export function LabIntakePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [labStaff, setLabStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('INCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Accept / Intake Modal State
  const [intakeOrder, setIntakeOrder] = useState(null);
  const [quotedCost, setQuotedCost] = useState('');
  const [confirmedDate, setConfirmedDate] = useState('');
  const [assignedTech, setAssignedTech] = useState('');
  const [labNotes, setLabNotes] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);

  // Request Revision Modal State
  const [revisionOrder, setRevisionOrder] = useState(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [isRequestingRevision, setIsRequestingRevision] = useState(false);

  // View Full Rx Slip Modal State
  const [selectedSlipOrder, setSelectedSlipOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubOrders = laboratoryService.subscribeToOrders((liveOrders) => {
      setOrders(liveOrders);
      setLoading(false);
    });

    const unsubUsers = authService.subscribeToUsers((allUsers) => {
      const techs = allUsers.filter(
        (u) => u.role === ROLES.LAB_TECH && !u.deactivated
      );
      setLabStaff(techs);
    });

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, []);

  // Categorized counts
  const counts = useMemo(() => {
    const incoming = orders.filter((o) => o.status === LAB_ORDER_STATUS.PENDING_REVIEW).length;
    const revision = orders.filter((o) => o.status === LAB_ORDER_STATUS.REVISION_NEEDED).length;
    const active = orders.filter((o) =>
      ['RECEIVED', 'DESIGN', 'MILLING', 'GLAZING', 'QA'].includes(o.status)
    ).length;
    const rushActive = orders.filter(
      (o) =>
        o.priority === 'RUSH' &&
        o.status !== LAB_ORDER_STATUS.DISPATCHED &&
        o.status !== LAB_ORDER_STATUS.COMPLETED
    ).length;
    const dispatched = orders.filter(
      (o) => o.status === LAB_ORDER_STATUS.DISPATCHED || o.status === LAB_ORDER_STATUS.COMPLETED
    ).length;

    return { incoming, revision, active, rushActive, dispatched, total: orders.length };
  }, [orders]);

  // Open Accept Modal populated with Dentist's requested defaults
  const openAcceptModal = (order) => {
    setIntakeOrder(order);
    setQuotedCost(order.cost || '₱3,500');
    setConfirmedDate(order.targetDeliveryDate || '');
    setAssignedTech(
      order.assignedTech || user?.fullName || labStaff[0]?.fullName || 'CAD/CAM Specialist'
    );
    setLabNotes(order.labNotes || '');
  };

  const handleConfirmAccept = async (e) => {
    e.preventDefault();
    if (!intakeOrder) return;
    setIsAccepting(true);
    try {
      await laboratoryService.acceptOrder(
        intakeOrder.id,
        {
          cost: quotedCost,
          targetDeliveryDate: confirmedDate,
          assignedTech,
          labNotes,
        },
        user?.fullName || user?.email || 'Laboratory Admin'
      );
      toast.success(
        `Order received! ${intakeOrder.applianceType} (${intakeOrder.patientName}) moved to CAD/CAM Production.`
      );
      setIntakeOrder(null);
    } catch (err) {
      toast.error('Failed to accept laboratory order.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSendRevisionRequest = async (e) => {
    e.preventDefault();
    if (!revisionOrder || !revisionReason.trim()) {
      toast.error('Please enter a clinical reason for returning this order.');
      return;
    }
    setIsRequestingRevision(true);
    try {
      await laboratoryService.requestRevision(
        revisionOrder.id,
        revisionReason.trim(),
        user?.fullName || user?.email || 'Laboratory Admin'
      );
      toast.info(`Order returned to Dr. ${revisionOrder.dentistName} for revision.`);
      setRevisionOrder(null);
      setRevisionReason('');
    } catch (err) {
      toast.error('Failed to request revision.');
    } finally {
      setIsRequestingRevision(false);
    }
  };

  const handleQuickAdvance = async (order) => {
    const idx = LAB_ORDER_STAGES.indexOf(order.status);
    if (idx === -1 || idx >= LAB_ORDER_STAGES.length - 1) return;
    const nextStage = LAB_ORDER_STAGES[idx + 1];
    setUpdatingId(order.id);
    try {
      await laboratoryService.updateStatus(
        order.id,
        nextStage,
        user?.fullName || 'Laboratory Admin'
      );
      toast.success(
        nextStage === LAB_ORDER_STATUS.DISPATCHED
          ? `📦 Dispatched ${order.applianceType} back to Dr. ${order.dentistName}!`
          : `Advanced order to ${STATUS_LABELS[nextStage] || nextStage}`
      );
    } catch (err) {
      toast.error('Failed to update production stage.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered orders for the selected tab
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab === 'INCOMING' && o.status !== LAB_ORDER_STATUS.PENDING_REVIEW) return false;
      if (
        activeTab === 'ACTIVE' &&
        !['RECEIVED', 'DESIGN', 'MILLING', 'GLAZING', 'QA'].includes(o.status)
      ) {
        return false;
      }
      if (activeTab === 'REVISION' && o.status !== LAB_ORDER_STATUS.REVISION_NEEDED) return false;
      if (
        activeTab === 'DISPATCHED' &&
        o.status !== LAB_ORDER_STATUS.DISPATCHED &&
        o.status !== LAB_ORDER_STATUS.COMPLETED
      ) {
        return false;
      }

      if (priorityFilter !== 'ALL' && (o.priority || 'STANDARD') !== priorityFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          o.id,
          o.patientName,
          o.dentistName,
          o.applianceType,
          o.material,
          o.shade,
          ...(o.toothNumbers || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [orders, activeTab, priorityFilter, searchQuery]);

  const tabs = [
    { id: 'INCOMING', label: 'Incoming from Dentist', badge: counts.incoming },
    { id: 'ACTIVE', label: 'In Fabrication', badge: counts.active },
    { id: 'REVISION', label: 'Returned for Revision', badge: counts.revision },
    { id: 'DISPATCHED', label: 'Dispatched & Fitted', badge: counts.dispatched },
    { id: 'ALL', label: 'All Work Orders', badge: counts.total },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Laboratory Admin Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shadow-soft-lg border border-teal-500/20">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Reception Desk
            </span>
            {counts.incoming > 0 && (
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                {counts.incoming} New {counts.incoming === 1 ? 'Prescription' : 'Prescriptions'}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
            Laboratory Order Intake & Admin
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Receive digital lab prescriptions directly from clinic dentists, inspect attached radiographs & tooth specs, confirm pricing, and dispatch completed appliances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link to="/lab/board">
            <Button
              variant="primary"
              size="md"
              rightIcon={ArrowRight}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
            >
              Open 6-Stage CAD/CAM Board
            </Button>
          </Link>
        </div>
      </div>

      {/* Live KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Incoming Prescriptions"
          value={counts.incoming}
          subtitle="Awaiting Lab Admin intake"
          icon={Inbox}
          color="orange"
          trend={counts.incoming > 0 ? `${counts.incoming} waiting` : 'All reviewed'}
        />
        <StatCard
          title="Active Fabrication"
          value={counts.active}
          subtitle="In CAD/CAM production stages"
          icon={FlaskConical}
          color="teal"
        />
        <StatCard
          title="Rush Priority Cases"
          value={counts.rushActive}
          subtitle="Expedited turnaround required"
          icon={Zap}
          color="purple"
        />
        <StatCard
          title="Dispatched & Fitted"
          value={counts.dispatched}
          subtitle="Delivered back to chairside"
          icon={Truck}
          color="blue"
        />
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search patient, dentist, tooth #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-card border border-surface-border text-ink-primary placeholder:text-ink-muted outline-none focus:border-teal-500"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="py-2 px-3 text-xs rounded-xl bg-surface-card border border-surface-border text-ink-primary outline-none focus:border-teal-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="RUSH">🚨 Rush Only</option>
              <option value="STANDARD">Standard Only</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'INCOMING'
                ? 'No Unreviewed Dentist Prescriptions'
                : 'No Matching Laboratory Orders'
            }
            description={
              activeTab === 'INCOMING'
                ? 'New orders submitted by clinic dentists will appear here automatically in real time.'
                : 'Try switching tabs or clearing your search filter to view other laboratory work orders.'
            }
            icon={Inbox}
            actionLabel={activeTab === 'INCOMING' && counts.active > 0 ? 'View Active Fabrication' : undefined}
            onAction={
              activeTab === 'INCOMING' && counts.active > 0
                ? () => setActiveTab('ACTIVE')
                : undefined
            }
          />
        ) : activeTab === 'INCOMING' ? (
          /* Dedicated Card View for Incoming Dentist Orders */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOrders.map((order) => {
              const isRush = order.priority === 'RUSH';
              return (
                <Card
                  key={order.id}
                  className={`p-5 space-y-4 border-2 transition-all ${
                    isRush
                      ? 'border-rose-400/70 dark:border-rose-500/50 bg-rose-50/20 dark:bg-rose-950/10'
                      : 'border-amber-300/70 dark:border-amber-500/30'
                  }`}
                >
                  {/* Top Meta Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRush ? (
                          <Badge variant="danger" size="sm" showDot>
                            RUSH PRIORITY
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm" showDot>
                            NEW PRESCRIPTION
                          </Badge>
                        )}
                        <span className="text-[11px] font-mono text-ink-muted">
                          Rx #{order.id.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          • {formatRelativeTime(order.createdAt) || 'Just received'}
                        </span>
                      </div>
                      <h3 className="text-lg font-heading font-extrabold text-ink-primary">
                        {order.applianceType}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSlipOrder(order)}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline shrink-0 flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Rx Slip
                    </button>
                  </div>

                  {/* Dentist & Patient Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
                          Ordering Dentist
                        </p>
                        <p className="font-bold text-ink-primary truncate">
                          Dr. {order.dentistName || 'Clinic Dentist'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
                          Patient Case
                        </p>
                        <p className="font-bold text-ink-primary truncate">
                          {order.patientName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Specs Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {order.material && (
                      <span className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-surface-border font-semibold text-ink-primary">
                        Material: {order.material}
                      </span>
                    )}
                    {order.shade && (
                      <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 font-bold text-teal-800 dark:text-teal-300">
                        Shade: {order.shade}
                      </span>
                    )}
                    {order.toothNumbers?.length > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 font-mono font-bold text-purple-800 dark:text-purple-300">
                        Teeth: #{order.toothNumbers.join(', #')}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-surface-subtle border border-surface-border text-ink-secondary flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-ink-muted" />
                      Target: <strong className="text-ink-primary">{formatDate(order.targetDeliveryDate)}</strong>
                    </span>
                  </div>

                  {/* Clinical Instructions */}
                  {order.notes && (
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-xs text-ink-primary">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-0.5">
                        Dentist Clinical Instructions
                      </span>
                      &ldquo;{order.notes}&rdquo;
                    </div>
                  )}

                  {/* Attached Scan / Radiograph or STL Link */}
                  {(order.attachmentUrl || order.cadFileUrl) && (
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {order.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlipOrder(order)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          View Attached Scan ({order.attachmentTitle || 'Radiograph'})
                        </button>
                      )}
                      {order.cadFileUrl && (
                        <a
                          href={order.cadFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Digital STL / CAD File
                        </a>
                      )}
                    </div>
                  )}

                  {/* Reception Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={RotateCcw}
                      onClick={() => {
                        setRevisionOrder(order);
                        setRevisionReason('');
                      }}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800/60"
                    >
                      Return for Revision
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={CheckCircle2}
                      onClick={() => openAcceptModal(order)}
                    >
                      Accept & Receive Order
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Comprehensive Table View for Active / Revision / Dispatched / All */
          <Card className="overflow-hidden shadow-soft-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="p-4 pl-6">Rx & Patient</th>
                    <th className="p-4">Dentist</th>
                    <th className="p-4">Prescription & Specs</th>
                    <th className="p-4">Target / Fee</th>
                    <th className="p-4">Pipeline Stage</th>
                    <th className="p-4 pr-6 text-right">Lab Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                  {filteredOrders.map((order) => {
                    const stageIdx = LAB_ORDER_STAGES.indexOf(order.status);
                    const canAdvance = stageIdx !== -1 && stageIdx < LAB_ORDER_STAGES.length - 1;
                    const nextStage = canAdvance ? LAB_ORDER_STAGES[stageIdx + 1] : null;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                      >
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2">
                            <p className="font-heading font-bold text-ink-primary">
                              {order.patientName}
                            </p>
                            {order.priority === 'RUSH' && (
                              <Badge variant="danger" size="sm">
                                RUSH
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-ink-muted">
                            Rx #{order.id.slice(0, 8)}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="font-semibold text-ink-primary">
                            Dr. {order.dentistName || 'Dentist'}
                          </p>
                          {order.assignedTech && (
                            <p className="text-[11px] text-teal-600 dark:text-teal-400">
                              Tech: {order.assignedTech}
                            </p>
                          )}
                        </td>

                        <td className="p-4">
                          <p className="font-bold text-ink-primary">{order.applianceType}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary mt-0.5">
                            {order.material && <span>{order.material}</span>}
                            {order.shade && <span>• Shade {order.shade}</span>}
                            {order.toothNumbers?.length > 0 && (
                              <span className="font-mono text-teal-700 dark:text-teal-400">
                                • #{order.toothNumbers.join(', #')}
                              </span>
                            )}
                          </div>
                          {order.revisionReason && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 italic">
                              Revision note: &ldquo;{order.revisionReason}&rdquo;
                            </p>
                          )}
                        </td>

                        <td className="p-4">
                          <p className="font-semibold text-ink-primary">
                            {formatDate(order.targetDeliveryDate)}
                          </p>
                          <p className="text-[11px] text-ink-muted">{order.cost || '—'}</p>
                        </td>

                        <td className="p-4">
                          <Badge status={order.status} size="sm" showDot>
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </td>

                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSlipOrder(order)}
                            >
                              Rx Slip
                            </Button>

                            {order.status === LAB_ORDER_STATUS.PENDING_REVIEW && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => openAcceptModal(order)}
                              >
                                Receive
                              </Button>
                            )}

                            {canAdvance && (
                              <Button
                                variant={nextStage === LAB_ORDER_STATUS.DISPATCHED ? 'primary' : 'secondary'}
                                size="sm"
                                isLoading={updatingId === order.id}
                                onClick={() => handleQuickAdvance(order)}
                              >
                                {nextStage === LAB_ORDER_STATUS.DISPATCHED
                                  ? 'Dispatch to Clinic'
                                  : `→ ${nextStage}`}
                              </Button>
                            )}
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

      {/* MODAL 1: Accept & Receive Order into Production */}
      <Modal
        isOpen={Boolean(intakeOrder)}
        onClose={() => setIntakeOrder(null)}
        title="Accept & Receive Dentist Prescription"
        description={
          intakeOrder
            ? `Rx #${intakeOrder.id.slice(0, 8)} • ${intakeOrder.applianceType} for ${intakeOrder.patientName}`
            : ''
        }
      >
        {intakeOrder && (
          <form onSubmit={handleConfirmAccept} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Ordering Dentist:</span>
                <strong className="text-ink-primary">Dr. {intakeOrder.dentistName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Material & Shade:</span>
                <strong className="text-ink-primary">
                  {intakeOrder.material || 'Standard'} • Shade {intakeOrder.shade || 'A2'}
                </strong>
              </div>
              {intakeOrder.toothNumbers?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Tooth Numbers:</span>
                  <strong className="font-mono text-teal-700 dark:text-teal-400">
                    #{intakeOrder.toothNumbers.join(', #')}
                  </strong>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Confirmed Lab Fee / Quote"
                value={quotedCost}
                onChange={(e) => setQuotedCost(e.target.value)}
                placeholder="e.g. ₱4,500"
                required
              />

              <Input
                label="Confirmed Delivery Date"
                type="date"
                value={confirmedDate}
                onChange={(e) => setConfirmedDate(e.target.value)}
                required
              />
            </div>

            {labStaff.length > 0 ? (
              <Select
                label="Assign Laboratory Specialist / Station"
                value={assignedTech}
                onChange={(e) => setAssignedTech(e.target.value)}
                options={labStaff.map((s) => ({
                  value: s.fullName || s.email,
                  label: `${s.fullName || s.email} (${s.specialty || 'CAD/CAM Lab'})`,
                }))}
              />
            ) : (
              <Input
                label="Assign Laboratory Specialist / Station"
                value={assignedTech}
                onChange={(e) => setAssignedTech(e.target.value)}
                placeholder="e.g. CAD/CAM Milling Station 1"
              />
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Laboratory Intake Notes (Visible to Dentist)
              </label>
              <textarea
                rows={2}
                value={labNotes}
                onChange={(e) => setLabNotes(e.target.value)}
                placeholder="e.g. Digital margin verified, scheduled for zirconia sintering batch B..."
                className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setIntakeOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isAccepting} leftIcon={CheckCircle2}>
                Receive into Production
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 2: Return Order to Dentist for Revision */}
      <Modal
        isOpen={Boolean(revisionOrder)}
        onClose={() => setRevisionOrder(null)}
        title="Return Prescription to Dentist"
        description={
          revisionOrder
            ? `Notify Dr. ${revisionOrder.dentistName} what needs to be clarified or re-scanned.`
            : ''
        }
      >
        {revisionOrder && (
          <form onSubmit={handleSendRevisionRequest} className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Quick Clinical Templates
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REVISION_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setRevisionReason(tpl)}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded-xl bg-surface-subtle hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-surface-border text-ink-secondary hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                  >
                    + {tpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                Reason / Instructions for Dentist
              </label>
              <textarea
                rows={3}
                required
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Explain what scan, margin, or specification is needed before fabrication..."
                className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setRevisionOrder(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                isLoading={isRequestingRevision}
                leftIcon={AlertTriangle}
              >
                Send Back to Dentist
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: Full Digital Lab Rx Slip & Attached Scan Viewer */}
      <Modal
        isOpen={Boolean(selectedSlipOrder)}
        onClose={() => setSelectedSlipOrder(null)}
        title="Digital Dental Laboratory Prescription (Rx)"
        description={selectedSlipOrder ? `Work Order #${selectedSlipOrder.id}` : ''}
      >
        {selectedSlipOrder && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-subtle border border-surface-border">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Current Status
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge status={selectedSlipOrder.status} size="sm" showDot>
                    {STATUS_LABELS[selectedSlipOrder.status] || selectedSlipOrder.status}
                  </Badge>
                  {selectedSlipOrder.priority === 'RUSH' && (
                    <Badge variant="danger" size="sm">
                      RUSH
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Submitted On
                </p>
                <p className="font-semibold text-ink-primary mt-1">
                  {formatDateTime(selectedSlipOrder.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border border-surface-border">
              <div>
                <p className="text-ink-muted">Ordering Dentist</p>
                <p className="font-bold text-ink-primary text-sm">
                  Dr. {selectedSlipOrder.dentistName}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Patient Name</p>
                <p className="font-bold text-ink-primary text-sm">
                  {selectedSlipOrder.patientName}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Appliance / Prosthesis</p>
                <p className="font-bold text-ink-primary">{selectedSlipOrder.applianceType}</p>
              </div>
              <div>
                <p className="text-ink-muted">Material & Shade</p>
                <p className="font-bold text-ink-primary">
                  {selectedSlipOrder.material || 'Standard'} • Shade {selectedSlipOrder.shade || 'A2'}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Target Delivery</p>
                <p className="font-bold text-ink-primary">
                  {formatDate(selectedSlipOrder.targetDeliveryDate)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Quoted Fee / Lab</p>
                <p className="font-bold text-ink-primary">
                  {selectedSlipOrder.cost || '—'} ({selectedSlipOrder.vendor})
                </p>
              </div>
              {selectedSlipOrder.toothNumbers?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-ink-muted">Prescribed Tooth Numbers (FDI)</p>
                  <p className="font-mono font-bold text-teal-700 dark:text-teal-400">
                    #{selectedSlipOrder.toothNumbers.join(', #')}
                  </p>
                </div>
              )}
            </div>

            {selectedSlipOrder.notes && (
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                  Dentist Clinical Notes
                </p>
                <p className="text-ink-primary">{selectedSlipOrder.notes}</p>
              </div>
            )}

            {selectedSlipOrder.labNotes && (
              <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-1">
                  Laboratory Notes ({selectedSlipOrder.receivedBy || 'Lab'})
                </p>
                <p className="text-ink-primary">{selectedSlipOrder.labNotes}</p>
              </div>
            )}

            {selectedSlipOrder.attachmentUrl && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Attached Patient Diagnostic Scan ({selectedSlipOrder.attachmentTitle || 'Scan'})
                </p>
                <a
                  href={selectedSlipOrder.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl overflow-hidden border border-surface-border bg-slate-950"
                >
                  <img
                    src={selectedSlipOrder.attachmentUrl}
                    alt={selectedSlipOrder.attachmentTitle || 'Attached Dental Scan'}
                    className="w-full max-h-56 object-contain"
                  />
                </a>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-surface-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={Printer}
                onClick={() => window.print()}
              >
                Print Lab Slip
              </Button>

              <div className="flex items-center gap-2">
                {selectedSlipOrder.status === LAB_ORDER_STATUS.PENDING_REVIEW && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const ord = selectedSlipOrder;
                      setSelectedSlipOrder(null);
                      openAcceptModal(ord);
                    }}
                  >
                    Accept & Receive
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSlipOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

