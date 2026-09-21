import React, { useState } from 'react';
import { Sparkles, AlertCircle, Shield, Layers, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ToothDetailsModal } from './ToothDetailsModal';
import { TOOTH_CONDITIONS } from '../../services/odontogramService';

// Quadrant groupings
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

// Mapping FDI to Universal Numbering
const FDI_TO_UNIVERSAL = {
  18: 1, 17: 2, 16: 3, 15: 4, 14: 5, 13: 6, 12: 7, 11: 8,
  21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
  38: 17, 37: 18, 36: 19, 35: 20, 34: 21, 33: 22, 32: 23, 31: 24,
  41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
};

export function OdontogramChart({
  teeth = {},
  onUpdateTooth,
  readOnly = false,
}) {
  const [selectedTooth, setSelectedTooth] = useState(null);

  const getToothStatusColor = (condition) => {
    switch (condition) {
      case 'CARIES':
        return 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400';
      case 'COMPOSITE':
        return 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400';
      case 'AMALGAM':
        return 'bg-slate-500/10 border-slate-500 text-slate-700 dark:text-slate-300';
      case 'CROWN':
        return 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400';
      case 'ROOT_CANAL':
        return 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400';
      case 'MISSING':
        return 'bg-surface-subtle border-dashed border-ink-tertiary/40 text-ink-tertiary opacity-50';
      case 'IMPLANT':
        return 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400';
      default:
        return 'bg-surface-card border-surface-border text-ink-primary hover:border-teal-400';
    }
  };

  const renderTooth = (toothNumber) => {
    const tooth = teeth[toothNumber] || {
      toothNumber,
      condition: 'HEALTHY',
      surfaces: [],
      treatmentStatus: 'NONE',
    };
    const condition = tooth.condition || 'HEALTHY';
    const isProblematic = condition !== 'HEALTHY';
    const universalNumber = FDI_TO_UNIVERSAL[toothNumber];

    return (
      <button
        key={toothNumber}
        type="button"
        onClick={() => setSelectedTooth(tooth)}
        className={`relative flex flex-col items-center justify-between p-2 rounded-xl border-2 transition-all hover:scale-105 shadow-soft-sm ${getToothStatusColor(
          condition
        )} w-12 sm:w-14 h-16 sm:h-20`}
        title={`Tooth #${toothNumber} (Universal #${universalNumber}) - ${condition}`}
      >
        <div className="flex items-center justify-between w-full text-[10px] font-mono font-bold leading-none text-ink-secondary">
          <span>{toothNumber}</span>
          <span className="opacity-60">#{universalNumber}</span>
        </div>

        {/* Tooth Visual Graphic */}
        <div className="relative my-1 flex items-center justify-center">
          <div
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
              condition === 'CARIES'
                ? 'bg-rose-500 text-white'
                : condition === 'CROWN'
                ? 'bg-amber-500 text-white'
                : condition === 'ROOT_CANAL'
                ? 'bg-purple-500 text-white'
                : condition === 'COMPOSITE'
                ? 'bg-blue-500 text-white'
                : condition === 'MISSING'
                ? 'bg-gray-400 text-white line-through'
                : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
            }`}
          >
            {condition === 'HEALTHY'
              ? '✓'
              : condition === 'CARIES'
              ? 'C'
              : condition === 'CROWN'
              ? 'Cr'
              : condition === 'ROOT_CANAL'
              ? 'RC'
              : condition === 'COMPOSITE'
              ? 'Co'
              : condition === 'MISSING'
              ? 'X'
              : '•'}
          </div>
        </div>

        {/* Surfaces Tag */}
        <div className="text-[9px] font-semibold truncate max-w-full leading-none">
          {tooth.surfaces?.length > 0 ? tooth.surfaces.map((s) => s[0]).join('') : isProblematic ? condition.slice(0, 3) : ''}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-ink-primary flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            32-Tooth Permanent Dentition Chart (FDI / Universal Notation)
          </span>
          <span className="text-[11px] text-ink-secondary">
            {readOnly ? 'View mode' : 'Click any tooth to chart conditions or surfaces'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(TOOTH_CONDITIONS).map(([key, info]) => (
            <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-card border border-surface-border text-ink-secondary text-[11px]">
              <span className={`w-2 h-2 rounded-full ${
                key === 'CARIES' ? 'bg-rose-500' :
                key === 'CROWN' ? 'bg-amber-500' :
                key === 'ROOT_CANAL' ? 'bg-purple-500' :
                key === 'COMPOSITE' ? 'bg-blue-500' :
                key === 'MISSING' ? 'bg-gray-400' :
                'bg-emerald-500'
              }`} />
              <span>{info.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dental Arch Display */}
      <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-soft space-y-8 overflow-x-auto">
        {/* Upper Arch (Maxilla) */}
        <div className="space-y-2">
          <div className="text-center text-xs font-heading font-bold tracking-wider uppercase text-teal-700 dark:text-teal-400">
            Maxillary Arch (Upper Teeth)
          </div>
          <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-[700px]">
            {/* Upper Right Quadrant 1 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {UPPER_RIGHT.map(renderTooth)}
            </div>

            <div className="w-px h-16 bg-surface-border mx-2" />

            {/* Upper Left Quadrant 2 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {UPPER_LEFT.map(renderTooth)}
            </div>
          </div>
        </div>

        <div className="w-full border-t border-dashed border-surface-border" />

        {/* Lower Arch (Mandible) */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-[700px]">
            {/* Lower Right Quadrant 4 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {LOWER_RIGHT.map(renderTooth)}
            </div>

            <div className="w-px h-16 bg-surface-border mx-2" />

            {/* Lower Left Quadrant 3 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {LOWER_LEFT.map(renderTooth)}
            </div>
          </div>
          <div className="text-center text-xs font-heading font-bold tracking-wider uppercase text-teal-700 dark:text-teal-400">
            Mandibular Arch (Lower Teeth)
          </div>
        </div>
      </div>

      {/* Tooth Modal */}
      {selectedTooth && (
        <ToothDetailsModal
          isOpen={!!selectedTooth}
          onClose={() => setSelectedTooth(null)}
          tooth={selectedTooth}
          onSave={onUpdateTooth}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
