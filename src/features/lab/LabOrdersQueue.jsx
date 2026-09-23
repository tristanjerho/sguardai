import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  User,
  RefreshCw,
  Layers,
  FileCode,
} from 'lucide-react';
import { laboratoryService } from '../../services/laboratoryService';
import { LAB_ORDER_STAGES } from '../../lib/constants';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

const STAGE_CONFIG = {
  RECEIVED: { label: 'Received & Intake', color: 'slate', desc: 'Case received & verified' },
  DESIGN: { label: 'CAD Design', color: 'blue', desc: 'Digital crown/appliance 3D modeling' },
  MILLING: { label: 'CAM Milling / 3D Print', color: 'purple', desc: 'Zirconia/Resin subtractive or additive process' },
  GLAZING: { label: 'Staining & Glazing', color: 'amber', desc: 'Furnace sintering & shade characterization' },
  QA: { label: 'Quality Assurance', color: 'teal', desc: 'Margin fit & occlusion inspection' },
  DISPATCHED: { label: 'Dispatched / In-Transit', color: 'emerald', desc: 'Couriered back to clinic' },
};

export function LabOrdersQueue() {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await laboratoryService.list();
      setOrders(data);
    } catch (err) {
      toast.error('Failed to load laboratory orders from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleAdvanceStage = async (orderId, currentStage) => {
    const currentIndex = LAB_ORDER_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= LAB_ORDER_STAGES.length - 1) return;

    const nextStage = LAB_ORDER_STAGES[currentIndex + 1];
    setUpdatingId(orderId);
    try {
      await laboratoryService.updateStatus(orderId, nextStage, user?.fullName || 'Lab Technician');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStage } : o))
      );
      toast.success(`Order advanced to ${STAGE_CONFIG[nextStage]?.label || nextStage}`);
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
              CAD/CAM Digital Workflow
            </Badge>
            <span className="text-xs text-ink-secondary">
              Total Active Work Orders: {orders.filter((o) => o.status !== 'DISPATCHED').length}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Laboratory Production Board
          </h2>
          <p className="text-sm text-ink-secondary">
            Live digital tracking from STL intake to sintering and dispatch.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={RefreshCw}
          onClick={loadOrders}
        >
          Refresh Board
        </Button>
      </div>

      {/* Kanban Board Columns (6 Stages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {LAB_ORDER_STAGES.map((stage) => {
          const stageOrders = orders.filter((o) => o.status === stage);
          const stageInfo = STAGE_CONFIG[stage] || { label: stage, color: 'slate', desc: '' };
          const stageIndex = LAB_ORDER_STAGES.indexOf(stage);
          const hasNext = stageIndex < LAB_ORDER_STAGES.length - 1;

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
                    {stageOrders.length} {stageOrders.length === 1 ? 'order' : 'orders'}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-teal-500" />
              </div>

              {/* Order Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[650px]">
                {stageOrders.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-ink-muted italic">
                    No orders at this stage
                  </div>
                ) : (
                  stageOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="p-3.5 space-y-2.5 bg-surface-card border-surface-border shadow-soft-sm hover:border-teal-400 transition-all"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-heading font-bold text-xs text-ink-primary line-clamp-1">
                          {order.applianceType}
                        </span>
                        {order.shade && (
                          <Badge variant="primary" size="sm">
                            Shade {order.shade}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] text-ink-secondary">
                        <div className="flex items-center gap-1 text-ink-primary font-medium">
                          <User className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="truncate">{order.patientName}</span>
                        </div>
                        {order.toothNumbers?.length > 0 && (
                          <div className="text-teal-700 dark:text-teal-400 font-mono text-[10px]">
                            Teeth: #{order.toothNumbers.join(', #')}
                          </div>
                        )}
                        <div className="text-ink-muted text-[10px]">
                          Due: {order.targetDeliveryDate ? formatDate(order.targetDeliveryDate) : 'Not set'}
                        </div>
                        <div className="text-ink-muted text-[10px] truncate">
                          Dr. {order.dentistName}
                        </div>
                      </div>

                      {order.notes && (
                        <div className="text-[10px] italic p-1.5 rounded-lg bg-surface-subtle text-ink-secondary line-clamp-2">
                          &ldquo;{order.notes}&rdquo;
                        </div>
                      )}

                      {hasNext && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-[10px] py-1 h-auto"
                          rightIcon={ArrowRight}
                          isLoading={updatingId === order.id}
                          onClick={() => handleAdvanceStage(order.id, stage)}
                        >
                          Advance to {STAGE_CONFIG[LAB_ORDER_STAGES[stageIndex + 1]]?.label?.split(' ')[0]}
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
