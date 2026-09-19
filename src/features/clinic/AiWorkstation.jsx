import React, { useState } from 'react';
import {
  BrainCircuit,
  UploadCloud,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  FileCheck,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { aiService } from '../../services/aiService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const SAMPLE_XRAYS = [
  {
    id: 'sample-1',
    name: 'Panoramic OPG Full Arch (Impacted Molar & Caries)',
    url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=900&auto=format&fit=crop&q=80',
  },
  {
    id: 'sample-2',
    name: 'Periapical Quadrant Radiograph',
    url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=900&auto=format&fit=crop&q=80',
  },
];

export function AiWorkstation() {
  const toast = useToast();
  const [selectedImage, setSelectedImage] = useState(SAMPLE_XRAYS[0].url);
  const [heatmapOpacity, setHeatmapOpacity] = useState(65);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Clinical verification form
  const [dentistVerification, setDentistVerification] = useState({
    confirmedFindings: true,
    treatmentAction: 'PROCEED_SURGICAL_EXTRACTION',
    clinicalSignoffNotes: 'Confirmed impacted #38 with root proximity. Recommended surgical extraction under local anesthesia.',
    signed: false,
  });

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await aiService.analyzeRadiograph(selectedImage);
      setAnalysisResult(result);
      toast.success('AI Deep Learning model inference completed.');
    } catch (err) {
      toast.error('AI inference failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSignOff = (e) => {
    e.preventDefault();
    setDentistVerification({ ...dentistVerification, signed: true });
    toast.success('Clinical verification signed and appended to patient chart.');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" size="sm">
              Deep Learning v3.2
            </Badge>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
              DEMO DATA SIMULATION
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            AI Diagnostic Workstation & Grad-CAM Heatmap
          </h2>
          <p className="text-sm text-ink-secondary">
            Assisted radiograph segmentation, pathology detection, and activation heatmaps.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={isAnalyzing}
          onClick={handleRunAnalysis}
          leftIcon={BrainCircuit}
        >
          {analysisResult ? 'Re-run Model Inference' : 'Run AI Analysis'}
        </Button>
      </div>

      {/* Strict Clinical Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-sm">
            Regulatory Compliance Notice (FDA / CDRRHR Dental Software Guidelines):
          </p>
          <p>
            &ldquo;<strong>AI suggestion only. Final diagnosis is made by the dentist.</strong>&rdquo; Neural activation maps and confidence probabilities are for secondary diagnostic assistance only.
          </p>
        </div>
      </div>

      {/* Main Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Radiograph & Grad-CAM Composite (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-5 space-y-4 shadow-soft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <CardTitle>Grad-CAM Visual Explanations</CardTitle>
              </div>

              {/* Sample Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Preset:</span>
                <select
                  value={selectedImage}
                  onChange={(e) => {
                    setSelectedImage(e.target.value);
                    setAnalysisResult(null);
                  }}
                  className="bg-surface-base border border-surface-border rounded-xl px-2.5 py-1.5 text-xs text-ink-primary outline-none"
                >
                  {SAMPLE_XRAYS.map((s) => (
                    <option key={s.id} value={s.url}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Opacity Slider Control */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border text-xs">
              <Sliders className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <span className="font-bold text-ink-primary whitespace-nowrap">
                Heatmap Opacity: {heatmapOpacity}%
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <span className="text-ink-muted text-[11px]">0% (Original) - 100% (Overlay)</span>
            </div>

            {/* Image Canvas with Grad-CAM Composite Layer */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[360px] sm:min-h-[440px] flex items-center justify-center">
              {/* Original Radiograph Image */}
              <img
                src={selectedImage}
                alt="Original Radiograph"
                className="w-full h-full object-contain max-h-[500px]"
              />

              {/* Grad-CAM Heatmap Synthetic Overlay */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                style={{
                  opacity: heatmapOpacity / 100,
                  background:
                    'radial-gradient(circle at 72% 68%, rgba(239, 68, 68, 0.85) 0%, rgba(245, 158, 11, 0.7) 22%, rgba(16, 185, 129, 0.4) 45%, transparent 70%), radial-gradient(circle at 35% 42%, rgba(245, 158, 11, 0.8) 0%, rgba(59, 130, 246, 0.3) 30%, transparent 60%)',
                  mixBlendMode: 'screen',
                }}
              />

              {/* Annotation labels overlay */}
              <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[11px] flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Max Activation (#38 Impacted)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Caries Focus (#16)
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Predictions & Clinical Signoff Form (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Predictions Card */}
          <Card className="p-5 space-y-4 shadow-soft">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="font-heading font-bold text-sm text-ink-primary">
                Model Predictions
              </h3>
              <Badge variant="primary" size="sm">
                Confidence
              </Badge>
            </div>

            <div className="space-y-3">
              {/* Finding 1: High Confidence */}
              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink-primary">Impacted Molar (#38)</span>
                  <span className="text-emerald-600 dark:text-emerald-400">94.2% (High)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94.2%' }} />
                </div>
                <p className="text-[11px] text-ink-muted">
                  Mesioangular impaction contacting distal root.
                </p>
              </div>

              {/* Finding 2: Moderate Confidence */}
              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink-primary">Interproximal Caries (#16)</span>
                  <span className="text-amber-600 dark:text-amber-400">76.5% (Mod)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '76.5%' }} />
                </div>
                <p className="text-[11px] text-ink-muted">
                  Radiolucency extending into middle third dentin.
                </p>
              </div>

              {/* Finding 3: Low Confidence Warning */}
              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink-primary">Periapical Radiolucency (#24)</span>
                  <span className="text-rose-600 dark:text-rose-400">48.1% (Low)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-surface-300 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '48.1%' }} />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-rose-700 dark:text-rose-300 font-semibold">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>Low Confidence Warning: Manual examination required.</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Dentist Clinical Verification Form */}
          <Card className="p-5 space-y-4 shadow-soft border-teal-200 dark:border-teal-800/60">
            <div className="flex items-center gap-2 border-b border-surface-border pb-3">
              <FileCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="font-heading font-bold text-sm text-ink-primary">
                Dentist Clinical Sign-off
              </h3>
            </div>

            <form onSubmit={handleSignOff} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                  Clinical Action Plan
                </label>
                <select
                  value={dentistVerification.treatmentAction}
                  onChange={(e) =>
                    setDentistVerification({ ...dentistVerification, treatmentAction: e.target.value })
                  }
                  className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs font-semibold text-ink-primary outline-none focus:border-teal-500"
                >
                  <option value="PROCEED_SURGICAL_EXTRACTION">Proceed with Surgical Extraction (#38)</option>
                  <option value="SCHEDULE_RESTORATION">Schedule Class II Composite Restoration (#16)</option>
                  <option value="ORDER_CBCT_3D">Order 3D Cone Beam CT for High Precision</option>
                  <option value="MONITOR_ROUTINE">No Immediate Pathology - Monitor Next Visit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary">
                  Dentist Diagnostic Notes
                </label>
                <textarea
                  value={dentistVerification.clinicalSignoffNotes}
                  onChange={(e) =>
                    setDentistVerification({
                      ...dentistVerification,
                      clinicalSignoffNotes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full bg-surface-card border border-surface-border rounded-xl p-2.5 text-xs text-ink-primary outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <Button
                type="submit"
                variant={dentistVerification.signed ? 'secondary' : 'primary'}
                size="md"
                className="w-full"
                leftIcon={CheckCircle2}
              >
                {dentistVerification.signed ? 'Clinical Sign-off Recorded ✓' : 'Sign & Append to Chart'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
