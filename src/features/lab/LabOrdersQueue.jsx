import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  ArrowRight,
  ArrowLeft,
  User,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { laboratoryService } from '../../services/laboratoryService';
import { LAB_ORDER_STAGES, LAB_ORDER_STATUS } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

const STAGE_CONFIG = {
  RECEIVED: { label: 'Received & Intake', color: 'slate', desc: 'Accepted by Lab Admin' },
  DESIGN: { label: 'CAD Design', color: 'blue', desc: 'Digital crown/appliance 3D modeling' },
  MILLING: { label: 'CAM Milling / 3D Print', color: 'purple', desc: 'Zirconia/Resin subtractive or additive process' },
  GLAZING: { label: 'Staining & Glazing', color: 'amber', desc: 'Furnace sintering & shade characterization' },
  QA: { label: 'Quality Assurance', color: 'teal', desc: 'Margin fit & occlusion inspection' },
  DISPATCHED: { label: 'Dispatched to Clinic', color: 'emerald', desc: 'Ready for chairside patient fitting' },
};

export function LabOrdersQueue() {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = laboratoryService.subscribeToOrders((liveOrders) => {
      setOrders(liveOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const incomingCount = orders.filter(
    (o) => o.status === LAB_ORDER_STATUS.PENDING_REVIEW
  ).length;

  const activeBoardCount = orders.filter((o) =>
    ['RECEIVED', 'DESIGN', 'MILLING', 'GLAZING', 'QA'].includes(o.status)
  ).length;

  const handleAdvanceStage = async (order, currentStage) => {
    const currentIndex = LAB_ORDER_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= LAB_ORDER_STAGES.length - 1) return;

    const nextStage = LAB_ORDER_STAGES[currentIndex + 1];
    setUpdatingId(order.id);
    try {
      await laboratoryService.updateStatus(
        order.id,
        nextStage,
        user?.fullName || 'Laboratory Specialist'
      );
      toast.success(
        nextStage === LAB_ORDER_STATUS.DISPATCHED
          ? `📦 Dispatched ${order.applianceType} back to Dr. ${order.dentistName}!`
          : `Order advanced to ${STAGE_CONFIG[nextStage]?.label || nextStage}`
      );
    } catch (err) {
      toast.error('Failed to advance order status in database.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" className="h-28" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {LAB_ORDER_STAGES.map((s) => (
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
              Real-Time CAD/CAM Pipeline
            </Badge>
            <span className="text-xs text-ink-secondary">
              In Fabrication: <strong>{activeBoardCount}</strong>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Laboratory Production Board
          </h2>
          <p className="text-sm text-ink-secondary">
            Live 6-stage fabrication tracking from accepted intake to sintering, QA, and clinic dispatch.
          </p>
        </div>

        <Link to="/lab">
          <Button variant="outline" size="sm" leftIcon={ArrowLeft}>
            Back to Order Intake {incomingCount > 0 ? `(${incomingCount} New)` : ''}
          </Button>
        </Link>
      </div>

      {/* Alert Banner when Dentist orders are waiting in Intake */}
      {incomingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <strong>
                {incomingCount} new dentist {incomingCount === 1 ? 'prescription is' : 'prescriptions are'} waiting in Order Intake!
              </strong>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Review specifications and click &ldquo;Accept &amp; Receive&rdquo; to bring them onto this production board.
              </p>
            </div>
          </div>

          <Link to="/lab" className="shrink-0">
            <Button variant="primary" size="sm" rightIcon={ArrowRight}>
              Review Incoming Orders
            </Button>
          </Link>
        </div>
      )}

      {/* Kanban Board Columns (6 Stages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {LAB_ORDER_STAGES.map((stage) => {
          const stageOrders = orders.filter((o) => o.status === stage);
          const stageInfo = STAGE_CONFIG[stage] || { label: stage, color: 'slate', desc: '' };
          const stageIndex = LAB_ORDER_STAGES.indexOf(stage);
          const hasNext = stageIndex < LAB_ORDER_STAGES.length - 1;
          const nextStageKey = hasNext ? LAB_ORDER_STAGES[stageIndex + 1] : null;

          return (
            <div
              key={stage}
              className="flex flex-col rounded-2xl bg-surface-subtle border border-surface-border p-3 min-w-[220px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-surface-border mb-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-heading font-bold text-ink-primary line-clamp-1">
                    {stageInfo.label}
                  </div>
                  <div className="text-[10px] text-ink-muted">
                    {stageOrders.length} {stageOrders.length === 1 ? 'case' : 'cases'}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-teal-500" />
              </div>

              {/* Order Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[650px]">
                {stageOrders.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-ink-muted italic">
                    No cases at this stage
                  </div>
                ) : (
                  stageOrders.map((order) => (
                    <Card
                      key={order.id}
                      className={`p-3.5 space-y-2.5 bg-surface-card shadow-soft-sm hover:border-teal-400 transition-all ${
                        order.priority === 'RUSH'
                          ? 'border-rose-400/70 dark:border-rose-500/50'
                          : 'border-surface-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-heading font-bold text-xs text-ink-primary line-clamp-2">
                          {order.applianceType}
                        </span>
                        {order.priority === 'RUSH' ? (
                          <Badge variant="danger" size="sm">
                            RUSH
                          </Badge>
                        ) : (
                          order.shade && (
                            <Badge variant="primary" size="sm">
                              {order.shade}
                            </Badge>
                          )
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] text-ink-secondary">
                        <div className="flex items-center gap-1 text-ink-primary font-semibold">
                          <User className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="truncate">{order.patientName}</span>
                        </div>
                        {order.material && (
                          <div className="text-[10px] text-ink-secondary truncate">
                            {order.material} {order.shade ? `• Shade ${order.shade}` : ''}
                          </div>
                        )}
                        {order.toothNumbers?.length > 0 && (
                          <div className="text-teal-700 dark:text-teal-400 font-mono text-[10px]">
                            Teeth: #{order.toothNumbers.join(', #')}
                          </div>
                        )}
                        <div className="text-ink-muted text-[10px]">
                          Due: {order.targetDeliveryDate ? formatDate(order.targetDeliveryDate) : 'TBD'}
                        </div>
                        <div className="text-ink-muted text-[10px] truncate">
                          Dr. {order.dentistName}
                        </div>
                        {order.assignedTech && (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium truncate">
                            Tech: {order.assignedTech}
                          </div>
                        )}
                      </div>

                      {order.notes && (
                        <div className="text-[10px] italic p-1.5 rounded-lg bg-surface-subtle text-ink-secondary line-clamp-2">
                          &ldquo;{order.notes}&rdquo;
                        </div>
                      )}

                      {(order.attachmentUrl || order.cadFileUrl) && (
                        <div className="flex items-center gap-2 pt-0.5">
                          {order.attachmentUrl && (
                            <a
                              href={order.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                            >
                              <ImageIcon className="w-3 h-3" /> Scan
                            </a>
                          )}
                          {order.cadFileUrl && (
                            <a
                              href={order.cadFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> STL
                            </a>
                          )}
                        </div>
                      )}

                      {hasNext && (
                        <Button
                          variant={nextStageKey === LAB_ORDER_STATUS.DISPATCHED ? 'primary' : 'secondary'}
                          size="sm"
                          className="w-full text-[10px] py-1.5 h-auto"
                          rightIcon={ArrowRight}
                          isLoading={updatingId === order.id}
                          onClick={() => handleAdvanceStage(order, stage)}
                        >
                          {nextStageKey === LAB_ORDER_STATUS.DISPATCHED
                            ? 'Dispatch to Clinic'
                            : `Advance to ${STAGE_CONFIG[nextStageKey]?.label?.split(' ')[0]}`}
                        </Button>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
