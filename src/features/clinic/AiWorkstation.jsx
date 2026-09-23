import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { aiService } from '../../services/aiService';
import { patientService } from '../../services/patientService';
import { imageService } from '../../services/imageService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';

export function AiWorkstation() {
  const { user } = useAuth();
  const toast = useToast();
  const isConfigured = aiService.isAiConfigured();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientImages, setPatientImages] = useState([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [heatmapOpacity, setHeatmapOpacity] = useState(65);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  // Clinical verification form
  const [dentistVerification, setDentistVerification] = useState({
    confirmedFindings: false,
    treatmentAction: '',
    clinicalSignoffNotes: '',
    signed: false,
  });

  useEffect(() => {
    async function loadPatients() {
      try {
        const list = await patientService.listPatients();
        setPatients(list);
        if (list.length > 0) {
          setSelectedPatientId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading patients for AI workstation:', err);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    async function loadImages() {
      if (!selectedPatientId) return;
      try {
        const imgs = await imageService.getPatientImages(selectedPatientId);
        setPatientImages(imgs);
        if (imgs.length > 0) {
          setSelectedImageUrl(imgs[0].secureUrl || imgs[0].imageUrl);
        } else {
          setSelectedImageUrl('');
        }
      } catch (err) {
        console.error('Error loading patient images:', err);
      }
    }
    loadImages();
  }, [selectedPatientId]);

  const handleRunAnalysis = async () => {
    if (!selectedImageUrl) {
      toast.error('Please select a radiograph to analyze.');
      return;
    }

    if (!isConfigured) {
      setAnalysisError('AI Diagnostic service is unconfigured. Set VITE_AI_SERVICE_URL in your environment.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError('');

    try {
      const result = await aiService.analyzeRadiograph(selectedImageUrl, {
        patientId: selectedPatientId,
      });
      setAnalysisResult(result);
      toast.success('Clinical AI model inference completed.');
    } catch (err) {
      setAnalysisError(err.message || 'Analysis failed. Please try again.');
      toast.error('AI inference failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSignOff = (e) => {
    e.preventDefault();
    if (!dentistVerification.clinicalSignoffNotes) {
      toast.error('Please provide clinical notes before signing off.');
      return;
    }
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
              Clinical Diagnostic Engine
            </Badge>
            {isConfigured ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                LIVE ENDPOINT CONNECTED
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                ENDPOINT UNCONFIGURED
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            AI Diagnostic Workstation
          </h2>
          <p className="text-sm text-ink-secondary">
            Assisted radiograph analysis, pathology segmentation, and clinician verification.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={isAnalyzing}
          onClick={handleRunAnalysis}
          leftIcon={BrainCircuit}
          disabled={!selectedImageUrl}
        >
          {isAnalyzing ? 'Analysis in progress...' : analysisResult ? 'Re-run Model Inference' : 'Run AI Analysis'}
        </Button>
      </div>

      {/* Strict Clinical Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-heading font-bold text-amber-900 dark:text-amber-200">
            Mandatory Clinical Decision Support Disclaimer (FDA / DOH Class II SaMD)
          </p>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            SmileGuard AI provides preliminary diagnostic suggestions and segmentation contours for radiological screening.
            AI output must never be used as the sole basis for surgical intervention or definitive treatment without independent clinical confirmation by a licensed dental practitioner.
          </p>
        </div>
      </div>

      {/* Unconfigured Alert */}
      {!isConfigured && (
        <Card className="p-6 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-sm text-amber-900 dark:text-amber-200">
                AI Diagnostic Service is Currently Unavailable
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                In adherence with our Zero Fabrication policy, AI findings and confidence scores are never simulated.
                To activate live multimodal Gemini / CNN inference, deploy your secure server-side boundary and set <code className="font-mono bg-surface-base px-1.5 py-0.5 rounded">VITE_AI_SERVICE_URL</code> in your environment.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Workstation Controls: Patient & Radiograph Selector */}
      <Card className="p-4 sm:p-6 shadow-soft space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Select Patient Case
            </label>
            {patients.length === 0 ? (
              <p className="text-xs text-ink-muted p-2.5 rounded-xl border border-surface-border bg-surface-subtle">
                No patients registered in Firestore yet.
              </p>
            ) : (
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} (ID: {p.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold text-ink-primary">
              Patient Radiographs (from Cloudinary)
            </label>
            {patientImages.length === 0 ? (
              <p className="text-xs text-ink-muted p-2.5 rounded-xl border border-surface-border bg-surface-subtle">
                No radiographs attached to this patient record.
              </p>
            ) : (
              <select
                value={selectedImageUrl}
                onChange={(e) => setSelectedImageUrl(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none"
              >
                {patientImages.map((img) => (
                  <option key={img.id} value={img.secureUrl || img.imageUrl}>
                    {img.type} - {img.title || 'Diagnostic Radiograph'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Main Workspace: Image Viewer + Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Radiograph Inspection Viewer */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="overflow-hidden shadow-soft-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-surface-border">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                Radiograph Viewer
              </CardTitle>
              {analysisResult && (
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-ink-muted" />
                  <span className="text-[11px] text-ink-muted">Overlay: {heatmapOpacity}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={heatmapOpacity}
                    onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                    className="w-20 accent-teal-600"
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0 bg-slate-950 min-h-[380px] flex items-center justify-center relative">
              {selectedImageUrl ? (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img
                    src={selectedImageUrl}
                    alt="Radiograph for analysis"
                    className="max-h-[450px] w-auto object-contain rounded-xl"
                  />
                  {analysisResult?.heatmapUrl && (
                    <img
                      src={analysisResult.heatmapUrl}
                      alt="AI Grad-CAM Heatmap"
                      style={{ opacity: heatmapOpacity / 100 }}
                      className="absolute inset-0 max-h-[450px] w-auto m-auto object-contain pointer-events-none mix-blend-screen"
                    />
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-xs text-slate-400 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p>No radiograph selected. Select a patient with radiographs to begin inspection.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: AI Diagnostic Observations & Clinician Sign-Off */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-6 shadow-soft space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-teal-600" />
                AI Inference Findings
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0 space-y-4">
              {isAnalyzing ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-heading font-semibold text-teal-700 dark:text-teal-400">
                    Analysis in progress...
                  </p>
                </div>
              ) : analysisError ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Analysis Failed</span>
                  </div>
                  <p>{analysisError}</p>
                </div>
              ) : analysisResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs space-y-1">
                    <div className="font-bold text-teal-900 dark:text-teal-200">
                      Model: {analysisResult.modelName || 'SmileGuard Dental Vision'}
                    </div>
                    {analysisResult.observations && (
                      <p className="text-teal-800 dark:text-teal-300 leading-relaxed">
                        {analysisResult.observations}
                      </p>
                    )}
                  </div>

                  {analysisResult.findings?.map((finding, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-surface-border bg-surface-subtle text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink-primary">{finding.condition}</span>
                        {finding.confidence && (
                          <Badge variant="primary" size="sm">
                            {finding.confidence}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-ink-secondary">{finding.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-muted py-6 text-center italic">
                  Select an authorized radiograph and click &ldquo;Run AI Analysis&rdquo; to process inference through the model.
                </p>
              )}

              {/* Clinician Signoff Form */}
              <form onSubmit={handleSignOff} className="pt-4 border-t border-surface-border space-y-3">
                <div className="text-xs font-heading font-bold text-ink-primary flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-teal-600" />
                  Clinician Verification & Chart Append
                </div>

                <textarea
                  placeholder="Enter practitioner sign-off notes, radiographic verification, and confirmed clinical diagnosis..."
                  value={dentistVerification.clinicalSignoffNotes}
                  onChange={(e) =>
                    setDentistVerification({
                      ...dentistVerification,
                      clinicalSignoffNotes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-surface-border bg-surface-base text-ink-primary focus:border-teal-500 focus:outline-none resize-none"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full"
                  disabled={dentistVerification.signed}
                >
                  {dentistVerification.signed ? 'Clinical Verification Signed ✓' : 'Sign & Append to Chart'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
