import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Sparkles, Check, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TOOTH_CONDITIONS } from '../../services/odontogramService';

const SURFACES = [
  { id: 'OCCLUSAL', label: 'Occlusal (O)', short: 'O', desc: 'Chewing surface' },
  { id: 'MESIAL', label: 'Mesial (M)', short: 'M', desc: 'Towards midline' },
  { id: 'DISTAL', label: 'Distal (D)', short: 'D', desc: 'Away from midline' },
  { id: 'BUCCAL', label: 'Buccal / Facial (B)', short: 'B', desc: 'Cheek/lip side' },
  { id: 'LINGUAL', label: 'Lingual (L)', short: 'L', desc: 'Tongue side' },
];

export function ToothDetailsModal({
  isOpen,
  onClose,
  tooth,
  onSave,
  readOnly = false,
}) {
  if (!tooth) return null;

  const [condition, setCondition] = useState(tooth.condition || 'HEALTHY');
  const [surfaces, setSurfaces] = useState(tooth.surfaces || []);
  const [treatmentStatus, setTreatmentStatus] = useState(tooth.treatmentStatus || 'NONE');
  const [diagnosis, setDiagnosis] = useState(tooth.diagnosis || '');
  const [notes, setNotes] = useState(tooth.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const toggleSurface = (surfId) => {
    if (readOnly) return;
    setSurfaces((prev) =>
      prev.includes(surfId) ? prev.filter((s) => s !== surfId) : [...prev, surfId]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(tooth.toothNumber, {
        condition,
        surfaces,
        treatmentStatus,
        diagnosis,
        notes,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tooth #${tooth.toothNumber} Clinical Charting`}
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Tooth Header Card */}
        <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between">
          <div>
            <div className="text-xs font-mono font-bold text-ink-secondary">FDI NOTATION</div>
            <div className="text-xl font-heading font-black text-ink-primary">Tooth #{tooth.toothNumber}</div>
          </div>
          <Badge
            variant={condition === 'HEALTHY' ? 'success' : condition === 'CARIES' ? 'danger' : 'primary'}
            size="md"
          >
            {TOOTH_CONDITIONS[condition]?.label || condition}
          </Badge>
        </div>

        {/* Condition Selector */}
        <div className="space-y-2">
          <label className="text-xs font-heading font-bold text-ink-primary">
            Pathological Condition / Clinical State
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TOOTH_CONDITIONS).map(([key, info]) => {
              const isSelected = condition === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setCondition(key)}
                  className={`p-2.5 rounded-xl text-left text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 shadow-soft-sm'
                      : 'border-surface-border bg-surface-card text-ink-secondary hover:border-surface-border-strong hover:text-ink-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{info.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Surfaces Selector */}
        <div className="space-y-2">
          <label className="text-xs font-heading font-bold text-ink-primary">
            Involved Surfaces (Tooth Anatomy)
          </label>
          <div className="flex flex-wrap gap-2">
            {SURFACES.map((surf) => {
              const isSelected = surfaces.includes(surf.id);
              return (
                <button
                  key={surf.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleSurface(surf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white shadow-soft-sm'
                      : 'border-surface-border bg-surface-card text-ink-secondary hover:border-teal-300'
                  }`}
                  title={surf.desc}
                >
                  {surf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Treatment Status */}
        <div className="space-y-2">
          <label className="text-xs font-heading font-bold text-ink-primary">
            Treatment Plan Status
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['NONE', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
              <button
                key={status}
                type="button"
                disabled={readOnly}
                onClick={() => setTreatmentStatus(status)}
                className={`p-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                  treatmentStatus === status
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200'
                    : 'border-surface-border bg-surface-card text-ink-secondary'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Clinical Diagnosis & Notes */}
        <div className="space-y-2">
          <label className="text-xs font-heading font-bold text-ink-primary">
            Clinical Findings & Notes
          </label>
          <textarea
            disabled={readOnly}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Incipient occlusal caries detected on radiograph. Recommended pit and fissure sealant or conservative composite restoration."
            rows={3}
            className="w-full text-xs p-3 rounded-xl border border-surface-border bg-surface-base focus:border-teal-500 focus:outline-none text-ink-primary resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
              Save to Patient Chart
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
