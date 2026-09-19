import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Plus,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { laboratoryService } from '../../services/laboratoryService';
import { patientService } from '../../services/patientService';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/formatters';
import { LAB_ORDER_STATUS } from '../../lib/constants';

export function LabOrdersManager() {
  const { user } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [applianceType, setApplianceType] = useState('');
  const [vendor, setVendor] = useState('CrownCraft Precision Dental Lab');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [cost, setCost] = useState('₱3,500');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change Modal
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const [orderList, patList] = await Promise.all([
        laboratoryService.list(),
        patientService.listPatients(),
      ]);
      setOrders(orderList);
      setPatients(patList);
      if (patList.length > 0) setPatientId(patList[0].id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    const selectedPat = patients.find((p) => p.id === patientId);

    setIsSubmitting(true);
    try {
      await laboratoryService.create(
        {
          patientId,
          patientName: selectedPat ? selectedPat.fullName : 'Patient',
          dentistId: user.id,
          dentistName: user.fullName || user.name || 'Dentist',
          applianceType,
          vendor,
          targetDeliveryDate,
          cost,
          notes,
        },
        user.fullName || user.name || 'Dentist'
      );
      toast.success('Dental laboratory order created successfully!');
      setIsCreateOpen(false);
      setApplianceType('');
      setNotes('');
      await loadOrders();
    } catch (err) {
      toast.error('Failed to create lab order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusModalOrder || !newStatus) return;
    try {
      await laboratoryService.updateStatus(
        statusModalOrder.id,
        newStatus,
        user.fullName || user.name || 'Dentist'
      );
      toast.success(`Lab Order #${statusModalOrder.id} marked as ${newStatus}.`);
      setStatusModalOrder(null);
      await loadOrders();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  const tabs = [
    { id: 'ALL', label: 'All Orders', badge: orders.length },
    { id: LAB_ORDER_STATUS.ORDERED, label: 'Ordered' },
    { id: LAB_ORDER_STATUS.IN_PROGRESS, label: 'In Lab Fabrication' },
    { id: LAB_ORDER_STATUS.READY, label: 'Ready for Fitting' },
    { id: LAB_ORDER_STATUS.DELIVERED, label: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Dental Laboratory Orders
          </h2>
          <p className="text-sm text-ink-secondary">
            Track retainers, crowns, diagnostic wax-ups, and palatal expander fabrications.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={Plus}
        >
          New Lab Order
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No Lab Orders Found"
          description="There are no active appliance fabrication orders in this status category."
          icon={FlaskConical}
          actionLabel="Create Lab Order"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-4 pl-6">Order ID & Patient</th>
                  <th className="p-4">Appliance Type</th>
                  <th className="p-4">Lab Vendor</th>
                  <th className="p-4">Target Delivery</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60 text-xs sm:text-sm">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-surface-50/60 dark:hover:bg-surface-100/30 transition-colors"
                  >
                    <td className="p-4 pl-6">
                      <p className="font-heading font-bold text-ink-primary">
                        {order.patientName}
                      </p>
                      <p className="text-[11px] text-ink-muted">{order.id}</p>
                    </td>

                    <td className="p-4 font-semibold text-ink-primary">
                      {order.applianceType}
                      {order.notes && (
                        <p className="text-[11px] text-ink-muted font-normal italic">
                          &ldquo;{order.notes}&rdquo;
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-ink-secondary">{order.vendor}</td>

                    <td className="p-4 text-ink-secondary">
                      {formatDate(order.targetDeliveryDate)}
                    </td>

                    <td className="p-4">
                      <Badge status={order.status} size="sm" showDot>
                        {order.status}
                      </Badge>
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setStatusModalOrder(order);
                          setNewStatus(order.status);
                        }}
                      >
                        Update Status
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Lab Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Dental Lab Order"
        description="Dispatch custom appliance prescription to certified dental fabrication laboratories."
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <Select
            label="Patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            options={patients.map((p) => ({ value: p.id, label: `${p.fullName} (${p.phone || p.email})` }))}
            required
          />

          <Input
            label="Appliance / Prosthesis Prescription"
            placeholder="e.g. Upper Hawley Retainer with Anterior Bite Plate"
            value={applianceType}
            onChange={(e) => setApplianceType(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Dental Laboratory Partner"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              options={[
                { value: 'CrownCraft Precision Dental Lab', label: 'CrownCraft Precision Dental Lab' },
                { value: 'Apex Dental Technologies', label: 'Apex Dental Technologies' },
                { value: 'SmileArtisan Dental Studio', label: 'SmileArtisan Dental Studio' },
              ]}
              required
            />

            <Input
              label="Target Delivery Date"
              type="date"
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Shade, Wire Gauge & Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Shade Vita A2, 0.028 labial bow, high polish finish..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
            >
              Dispatch Lab Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={!!statusModalOrder}
        onClose={() => setStatusModalOrder(null)}
        title="Update Lab Order Status"
        description={`Order #${statusModalOrder?.id}: ${statusModalOrder?.applianceType}`}
      >
        <div className="space-y-4">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={[
              { value: LAB_ORDER_STATUS.ORDERED, label: 'ORDERED (Prescription Sent)' },
              { value: LAB_ORDER_STATUS.IN_PROGRESS, label: 'IN_PROGRESS (Under Fabrication)' },
              { value: LAB_ORDER_STATUS.READY, label: 'READY (Arrived at Clinic)' },
              { value: LAB_ORDER_STATUS.DELIVERED, label: 'DELIVERED (Fitted to Patient)' },
            ]}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button variant="ghost" size="md" onClick={() => setStatusModalOrder(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleUpdateStatus}>
              Save Status
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
