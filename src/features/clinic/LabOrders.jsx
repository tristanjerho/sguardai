import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Truck,
  Clock,
  Zap,
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
import { formatDate, formatDateTime } from '../../lib/formatters';
import { LAB_ORDER_STATUS, LAB_MATERIALS, VITA_SHADES } from '../../lib/constants';

const APPLIANCE_PRESETS = [
  'Monolithic Zirconia Crown',
  '3-Unit Anterior Bridge',
  'Upper & Lower Hawley Retainers',
  'Clear Orthodontic Retainer (Essix)',
  'Hard/Soft Occlusal Nightguard',
  'Flexible Partial Denture',
];

const PIPELINE_STEPS = [
  { key: 'PENDING_REVIEW', label: 'Sent to Lab' },
  { key: 'RECEIVED', label: 'Accepted' },
  { key: 'DESIGN', label: 'CAD Design' },
  { key: 'MILLING', label: 'CAM Milling' },
  { key: 'GLAZING', label: 'Glazing' },
  { key: 'QA', label: 'Lab QA' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'COMPLETED', label: 'Fitted' },
];

const STATUS_LABELS = {
  PENDING_REVIEW: 'Sent • Awaiting Lab Intake',
  REVISION_NEEDED: 'Action Required • Lab Revision',
  RECEIVED: 'Accepted by Lab',
  DESIGN: 'CAD Design',
  MILLING: 'CAM Milling',
  GLAZING: 'Glazing & Sintering',
  QA: 'Quality Assurance',
  DISPATCHED: 'Dispatched • Ready for Fitting',
  COMPLETED: 'Fitted & Completed',
};

export function LabOrdersManager() {
  const { user } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientImages, setPatientImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create / Revise Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRevisionOrder, setEditingRevisionOrder] = useState(null);
  const [patientId, setPatientId] = useState('');
  const [applianceType, setApplianceType] = useState('');
  const [material, setMaterial] = useState(LAB_MATERIALS[0]);
  const [shade, setShade] = useState('A2');
  const [priority, setPriority] = useState('STANDARD');
  const [toothNumbersInput, setToothNumbersInput] = useState('');
  const [vendor, setVendor] = useState('SmileGuard In-House CAD/CAM Lab');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [cost, setCost] = useState('₱3,500');
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [cadFileUrl, setCadFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracking & Detail Modal State
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    let mounted = true;

    patientService
      .listPatients()
      .then((patList) => {
        if (mounted) {
          setPatients(patList);
          if (patList.length > 0) setPatientId((prev) => prev || patList[0].id);
        }
      })
      .catch((err) => console.error('Failed to load patients for lab order form:', err));

    const unsubOrders = laboratoryService.subscribeToOrders((liveOrders) => {
      if (mounted) {
        setOrders(liveOrders);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubOrders();
    };
  }, []);

  // Load selected patient's radiographs/scans when form is open
  useEffect(() => {
    if (!isFormOpen || !patientId) {
      setPatientImages([]);
      return;
    }
    imageService
      .getPatientImages(patientId)
      .then((imgs) => setPatientImages(imgs || []))
      .catch(() => setPatientImages([]));
  }, [isFormOpen, patientId]);

  const openCreateModal = () => {
    setEditingRevisionOrder(null);
    if (patients.length > 0 && !patientId) setPatientId(patients[0].id);
    setApplianceType('');
    setMaterial(LAB_MATERIALS[0]);
    setShade('A2');
    setPriority('STANDARD');
    setToothNumbersInput('');
    setVendor('SmileGuard In-House CAD/CAM Lab');
    setTargetDeliveryDate('');
    setCost('₱3,500');
    setSelectedAttachmentId('');
    setCadFileUrl('');
    setNotes('');
    setIsFormOpen(true);
  };

  const openRevisionModal = (order) => {
    setEditingRevisionOrder(order);
    setPatientId(order.patientId || '');
    setApplianceType(order.applianceType || '');
    setMaterial(order.material || LAB_MATERIALS[0]);
    setShade(order.shade || 'A2');
    setPriority(order.priority || 'STANDARD');
    setToothNumbersInput((order.toothNumbers || []).join(', '));
    setVendor(order.vendor || 'SmileGuard In-House CAD/CAM Lab');
    setTargetDeliveryDate(order.targetDeliveryDate || '');
    setCost(order.cost || '₱3,500');
    setSelectedAttachmentId('');
    setCadFileUrl(order.cadFileUrl || '');
    setNotes(order.notes || '');
    setIsFormOpen(true);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    const selectedPat = patients.find((p) => p.id === patientId);
    const chosenImg = patientImages.find((img) => img.id === selectedAttachmentId);

    setIsSubmitting(true);
    try {
      const actorName = user?.fullName || user?.name || 'Dentist';

      if (editingRevisionOrder) {
        await laboratoryService.resubmitOrder(
          editingRevisionOrder.id,
          {
            applianceType,
            material,
            shade,
            priority,
            toothNumbers: toothNumbersInput,
            targetDeliveryDate,
            cadFileUrl,
            attachmentUrl: chosenImg ? chosenImg.secureUrl || chosenImg.imageUrl : editingRevisionOrder.attachmentUrl,
            attachmentTitle: chosenImg ? chosenImg.title : editingRevisionOrder.attachmentTitle,
            notes,
          },
          actorName
        );
        toast.success('Updated prescription resubmitted to the Laboratory!');
      } else {
        await laboratoryService.create(
          {
            patientId,
            patientName: selectedPat ? selectedPat.fullName : 'Patient',
            dentistId: user?.id || user?.uid || '',
            dentistName: actorName,
            applianceType,
            material,
            shade,
            priority,
            toothNumbers: toothNumbersInput,
            vendor,
            targetDeliveryDate,
            cost,
            cadFileUrl,
            attachmentUrl: chosenImg ? chosenImg.secureUrl || chosenImg.imageUrl : '',
            attachmentTitle: chosenImg ? chosenImg.title : '',
            notes,
          },
          actorName
        );
        toast.success('Digital lab prescription sent to the Laboratory Intake desk!');
      }

      setIsFormOpen(false);
      setEditingRevisionOrder(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch laboratory prescription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFitted = async (order) => {
    setCompletingId(order.id);
    try {
      await laboratoryService.updateStatus(
        order.id,
        LAB_ORDER_STATUS.COMPLETED,
        user?.fullName || user?.name || 'Dentist'
      );
      toast.success(`Marked ${order.applianceType} (${order.patientName}) as fitted & completed!`);
      if (trackingOrder?.id === order.id) {
        setTrackingOrder(null);
      }
    } catch (err) {
      toast.error('Failed to mark order as completed.');
    } finally {
      setCompletingId(null);
    }
  };

  const revisionOrders = useMemo(
    () => orders.filter((o) => o.status === LAB_ORDER_STATUS.REVISION_NEEDED),
    [orders]
  );

  const dispatchedOrders = useMemo(
    () => orders.filter((o) => o.status === LAB_ORDER_STATUS.DISPATCHED),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'IN_PRODUCTION') {
        return ['RECEIVED', 'DESIGN', 'MILLING', 'GLAZING', 'QA'].includes(o.status);
      }
      return o.status === statusFilter;
    });
  }, [orders, statusFilter]);

  const tabs = [
    { id: 'ALL', label: 'All Prescriptions', badge: orders.length },
    {
      id: LAB_ORDER_STATUS.PENDING_REVIEW,
      label: 'Sent to Lab',
      badge: orders.filter((o) => o.status === LAB_ORDER_STATUS.PENDING_REVIEW).length,
    },
    {
      id: LAB_ORDER_STATUS.REVISION_NEEDED,
      label: 'Needs Revision',
      badge: revisionOrders.length,
    },
    {
      id: 'IN_PRODUCTION',
      label: 'In Fabrication',
      badge: orders.filter((o) =>
        ['RECEIVED', 'DESIGN', 'MILLING', 'GLAZING', 'QA'].includes(o.status)
      ).length,
    },
    {
      id: LAB_ORDER_STATUS.DISPATCHED,
      label: 'Ready for Fitting',
      badge: dispatchedOrders.length,
    },
    {
      id: LAB_ORDER_STATUS.COMPLETED,
      label: 'Fitted / Completed',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected to Laboratory Portal
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Dental Laboratory Prescriptions
          </h2>
          <p className="text-sm text-ink-secondary">
            Send digital appliance orders directly to the Laboratory Admin intake queue and track live CAD/CAM progress.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={openCreateModal}
          leftIcon={Plus}
        >
          New Lab Prescription
        </Button>
      </div>

      {/* Alert Banner if Laboratory returned any prescription for revision */}
      {revisionOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <strong>
                {revisionOrders.length} lab {revisionOrders.length === 1 ? 'prescription requires' : 'prescriptions require'} clinical revision
              </strong>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                Latest feedback on {revisionOrders[0].patientName} ({revisionOrders[0].applianceType}): &ldquo;{revisionOrders[0].revisionReason}&rdquo;
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            leftIcon={RotateCcw}
            onClick={() => openRevisionModal(revisionOrders[0])}
            className="shrink-0"
          >
            Revise &amp; Resubmit
          </Button>
        </div>
      )}

      {/* Ready for Chairside Fitting Banner */}
      {dispatchedOrders.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
            <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <strong>
                {dispatchedOrders.length} completed {dispatchedOrders.length === 1 ? 'appliance has' : 'appliances have'} been dispatched from the Laboratory!
              </strong>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                Ready for chairside try-in and patient delivery.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter(LAB_ORDER_STATUS.DISPATCHED)}
            className="shrink-0"
          >
            View Dispatched
          </Button>
        </div>
      )}

      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No Lab Prescriptions Found"
          description="Send a digital prescription to the Dental Laboratory to start appliance fabrication."
          icon={FlaskConical}
          actionLabel="New Lab Prescription"
          onAction={openCreateModal}
        />
      ) : (
        <Card className="overflow-hidden shadow-soft-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-50/80 dark:bg-surface-100/60 text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="p-4 pl-6">Rx &amp; Patient</th>
                  <th className="p-4">Appliance &amp; Specifications</th>
                  <th className="p-4">Receiving Laboratory</th>
                  <th className="p-4">Target Delivery &amp; Fee</th>
                  <th className="p-4">Live Lab Status</th>
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
                      <p className="font-semibold text-ink-primary">{order.applianceType}</p>
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
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                          Lab feedback: &ldquo;{order.revisionReason}&rdquo;
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-ink-secondary">
                      <p className="font-medium text-ink-primary">{order.vendor}</p>
                      {order.assignedTech && (
                        <p className="text-[11px] text-teal-600 dark:text-teal-400">
                          Assigned: {order.assignedTech}
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-ink-secondary">
                      <p className="font-medium text-ink-primary">
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
                          onClick={() => setTrackingOrder(order)}
                        >
                          Track Order
                        </Button>

                        {order.status === LAB_ORDER_STATUS.REVISION_NEEDED && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openRevisionModal(order)}
                          >
                            Revise Rx
                          </Button>
                        )}

                        {order.status === LAB_ORDER_STATUS.DISPATCHED && (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={CheckCircle2}
                            isLoading={completingId === order.id}
                            onClick={() => handleConfirmFitted(order)}
                          >
                            Confirm Fitted
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: Create / Revise Digital Lab Prescription */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRevisionOrder(null);
        }}
        title={
          editingRevisionOrder
            ? `Revise & Resubmit Rx #${editingRevisionOrder.id.slice(0, 8)}`
            : 'New Digital Dental Lab Prescription (Rx)'
        }
        description="Submit appliance specifications directly to the Laboratory Admin intake portal."
      >
        <form onSubmit={handleSubmitOrder} className="space-y-4">
          {editingRevisionOrder?.revisionReason && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
              <strong className="block uppercase text-[10px] tracking-wider mb-0.5">
                Laboratory Revision Request:
              </strong>
              &ldquo;{editingRevisionOrder.revisionReason}&rdquo;
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Select
                label="Patient"
                value={patientId}
                disabled={Boolean(editingRevisionOrder)}
                onChange={(e) => setPatientId(e.target.value)}
                options={
                  patients.length > 0
                    ? patients.map((p) => ({
                        value: p.id,
                        label: `${p.fullName} (${p.phone || p.email || 'Patient'})`,
                      }))
                    : [{ value: '', label: 'No registered patients yet' }]
                }
                required
              />
            </div>

            <Select
              label="Turnaround Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'STANDARD', label: 'Standard' },
                { value: 'RUSH', label: '🚨 Rush Case' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Input
              label="Appliance / Prosthesis Prescription"
              placeholder="e.g. Monolithic Zirconia Crown or Upper Hawley Retainer"
              value={applianceType}
              onChange={(e) => setApplianceType(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {APPLIANCE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setApplianceType(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-surface-border text-ink-secondary hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              options={LAB_MATERIALS.map((m) => ({ value: m, label: m }))}
            />

            <Select
              label="Vita Shade"
              value={shade}
              onChange={(e) => setShade(e.target.value)}
              options={VITA_SHADES.map((s) => ({ value: s, label: s }))}
            />

            <Input
              label="Tooth Numbers (FDI)"
              placeholder="e.g. 11, 12, 21"
              value={toothNumbersInput}
              onChange={(e) => setToothNumbersInput(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Receiving Dental Laboratory"
              value={vendor}
              disabled={Boolean(editingRevisionOrder)}
              onChange={(e) => setVendor(e.target.value)}
              options={[
                { value: 'SmileGuard In-House CAD/CAM Lab', label: 'SmileGuard In-House CAD/CAM Lab' },
                { value: 'CrownCraft Precision Dental Lab', label: 'CrownCraft Precision Dental Lab' },
                { value: 'Apex Dental Technologies', label: 'Apex Dental Technologies' },
                { value: 'SmileArtisan Dental Studio', label: 'SmileArtisan Dental Studio' },
              ]}
              required
            />

            <Input
              label="Requested Delivery Date"
              type="date"
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
              required
            />
          </div>

          {/* Optional Patient Radiograph / Scan Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Attach Patient Radiograph / Scan"
              value={selectedAttachmentId}
              onChange={(e) => setSelectedAttachmentId(e.target.value)}
              options={[
                {
                  value: '',
                  label:
                    patientImages.length > 0
                      ? `Optional (${patientImages.length} patient scans available)`
                      : 'No uploaded scans for this patient',
                },
                ...patientImages.map((img) => ({
                  value: img.id,
                  label: `${img.title} (${formatDate(img.createdAt)})`,
                })),
              ]}
            />

            <Input
              label="Digital STL / CAD Scan Link (Optional)"
              placeholder="https://..."
              value={cadFileUrl}
              onChange={(e) => setCadFileUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
              Margin Design, Occlusion &amp; Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Chamfer margin #11, light anterior contact, high glaze cervical third..."
              className="w-full bg-surface-card border border-surface-border rounded-xl p-3 text-sm outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setIsFormOpen(false);
                setEditingRevisionOrder(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              {editingRevisionOrder ? 'Resubmit to Laboratory' : 'Send Order to Laboratory'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Live Order Tracking & Digital Slip */}
      <Modal
        isOpen={Boolean(trackingOrder)}
        onClose={() => setTrackingOrder(null)}
        title="Live Laboratory Order Tracker"
        description={
          trackingOrder
            ? `Rx #${trackingOrder.id.slice(0, 8)} • ${trackingOrder.applianceType} (${trackingOrder.patientName})`
            : ''
        }
      >
        {trackingOrder && (
          <div className="space-y-5 text-xs">
            {/* Visual Step Progress */}
            {trackingOrder.status === LAB_ORDER_STATUS.REVISION_NEEDED ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Returned by Laboratory for Clinical Revision
                </p>
                <p>&ldquo;{trackingOrder.revisionReason}&rdquo;</p>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const ord = trackingOrder;
                    setTrackingOrder(null);
                    openRevisionModal(ord);
                  }}
                >
                  Update &amp; Resubmit Prescription
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Fabrication Pipeline
                  </span>
                  <Badge status={trackingOrder.status} size="sm" showDot>
                    {STATUS_LABELS[trackingOrder.status] || trackingOrder.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const currentIdx = PIPELINE_STEPS.findIndex(
                      (s) => s.key === trackingOrder.status
                    );
                    const done = currentIdx >= idx;
                    const active = currentIdx === idx;
                    return (
                      <div key={step.key} className="space-y-1 text-center">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            active
                              ? 'bg-teal-500 ring-2 ring-teal-400/40'
                              : done
                              ? 'bg-emerald-500'
                              : 'bg-surface-border'
                          }`}
                        />
                        <p
                          className={`text-[9px] leading-tight ${
                            active
                              ? 'font-extrabold text-teal-700 dark:text-teal-300'
                              : done
                              ? 'font-semibold text-ink-primary'
                              : 'text-ink-muted'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prescription Metadata */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border border-surface-border">
              <div>
                <p className="text-ink-muted">Patient</p>
                <p className="font-bold text-ink-primary">{trackingOrder.patientName}</p>
              </div>
              <div>
                <p className="text-ink-muted">Laboratory</p>
                <p className="font-bold text-ink-primary">{trackingOrder.vendor}</p>
              </div>
              <div>
                <p className="text-ink-muted">Material &amp; Shade</p>
                <p className="font-bold text-ink-primary">
                  {trackingOrder.material || 'Standard'} • Shade {trackingOrder.shade || 'A2'}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Target Date &amp; Fee</p>
                <p className="font-bold text-ink-primary">
                  {formatDate(trackingOrder.targetDeliveryDate)} ({trackingOrder.cost || '—'})
                </p>
              </div>
              {trackingOrder.toothNumbers?.length > 0 && (
                <div>
                  <p className="text-ink-muted">Tooth Numbers</p>
                  <p className="font-mono font-bold text-teal-700 dark:text-teal-400">
                    #{trackingOrder.toothNumbers.join(', #')}
                  </p>
                </div>
              )}
              {trackingOrder.assignedTech && (
                <div>
                  <p className="text-ink-muted">Assigned Lab Specialist</p>
                  <p className="font-bold text-teal-700 dark:text-teal-400">
                    {trackingOrder.assignedTech}
                  </p>
                </div>
              )}
            </div>

            {trackingOrder.labNotes && (
              <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-0.5">
                  Laboratory Intake Notes ({trackingOrder.receivedBy || 'Lab Admin'})
                </p>
                <p className="text-ink-primary">{trackingOrder.labNotes}</p>
              </div>
            )}

            {trackingOrder.attachmentUrl && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Attached Patient Scan ({trackingOrder.attachmentTitle || 'Radiograph'})
                </p>
                <img
                  src={trackingOrder.attachmentUrl}
                  alt="Attached Dental Scan"
                  className="w-full max-h-48 object-contain rounded-xl bg-slate-950 border border-surface-border"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
              {trackingOrder.status === LAB_ORDER_STATUS.DISPATCHED && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={CheckCircle2}
                  isLoading={completingId === trackingOrder.id}
                  onClick={() => handleConfirmFitted(trackingOrder)}
                >
                  Confirm Received &amp; Fitted
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setTrackingOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
