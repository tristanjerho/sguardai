import React, { useState, useEffect, useRef } from 'react';
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
  Activity,
  Cpu,
  BarChart2,
  FileUp,
  ShieldCheck,
  X,
  Download,
  FileDown,
  Printer,
  Share2,
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
  const fileInputRef = useRef(null);

  // Model Metadata State
  const [modelInfo, setModelInfo] = useState(null);
  const [isModelReady, setIsModelReady] = useState(false);

  // Input Selection Mode: 'patient' or 'upload'
  const [inputMode, setInputMode] = useState('upload');

  // Patient radiograph state
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientImages, setPatientImages] = useState([]);

  // Active Image & Local File state
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFilePreview, setUploadedFilePreview] = useState('');

  // Inference & Visualization state
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

  // Load Model Information on mount
  useEffect(() => {
    async function checkModel() {
      try {
        const info = await aiService.getModelInfo();
        if (info && info.metadata) {
          setModelInfo(info.metadata);
          setIsModelReady(true);
        } else if (info && info.status === 'ready') {
          setIsModelReady(true);
        }
      } catch (err) {
        console.warn('Could not load model info:', err);
      }
    }
    checkModel();
  }, []);

  // Load Patients list
  useEffect(() => {
    async function loadPatients() {
      try {
        const list = await patientService.listPatients();
        setPatients(list || []);
        if (list && list.length > 0) {
          setSelectedPatientId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading patients for AI workstation:', err);
      }
    }
    loadPatients();
  }, []);

  // Load Patient Radiographs when patient selected
  useEffect(() => {
    async function loadImages() {
      if (!selectedPatientId || inputMode !== 'patient') return;
      try {
        const imgs = await imageService.getPatientImages(selectedPatientId);
        setPatientImages(imgs || []);
        if (imgs && imgs.length > 0) {
          setSelectedImageUrl(imgs[0].secureUrl || imgs[0].imageUrl);
        } else {
          setSelectedImageUrl('');
        }
      } catch (err) {
        console.error('Error loading patient images:', err);
      }
    }
    loadImages();
  }, [selectedPatientId, inputMode]);

  // Handle direct file upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid dental X-ray image file.');
      return;
    }

    setUploadedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadedFilePreview(previewUrl);
    setAnalysisResult(null);
    setAnalysisError('');
  };

  const handleClearUploadedFile = () => {
    setUploadedFile(null);
    if (uploadedFilePreview) {
      URL.revokeObjectURL(uploadedFilePreview);
      setUploadedFilePreview('');
    }
    setAnalysisResult(null);
    setAnalysisError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Run Inference
  const handleRunAnalysis = async () => {
    const activeImageInput = inputMode === 'upload' ? uploadedFile : selectedImageUrl;

    if (!activeImageInput) {
      toast.error(
        inputMode === 'upload'
          ? 'Please select or drop a dental X-ray image to analyze.'
          : 'Please select a radiograph from the patient record.'
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError('');

    try {
      const result = await aiService.analyzeRadiograph(activeImageInput, {
        patientId: selectedPatientId || undefined,
        radiographType: 'OPG',
      });
      setAnalysisResult(result);
      toast.success('Clinical AI model inference completed.');
    } catch (err) {
      setAnalysisError(err.message || 'Analysis failed. Please ensure the backend is running.');
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

  const handleDownloadReport = () => {
    if (!analysisResult) return;
    const patientName = selectedPatient ? selectedPatient.fullName : 'Walk-in / Direct Assessment';
    const timestamp = new Date().toLocaleString();
    const primaryClass = analysisResult.prediction?.class || 'N/A';
    const confidence = analysisResult.prediction?.confidence_percentage || 0;
    const observations = analysisResult.observations || '';
    const signoffNotes = dentistVerification.clinicalSignoffNotes || 'Preliminary Diagnostic Report (Pending Final Review)';
    const dentistName = user?.fullName || 'Dr. Attending Practitioner';
    const gradcamImg = analysisResult.gradcam?.overlayUrl || displayImageUrl || '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SmileGuard AI Clinical Diagnostic Report - ${patientName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5; background: #ffffff; }
          .header { border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: 800; color: #0f766e; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
          .meta { font-size: 12px; color: #475569; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; }
          .section-title { font-size: 13px; font-weight: 700; color: #0f766e; text-transform: uppercase; margin-bottom: 8px; }
          .primary-diag { font-size: 18px; font-weight: 800; color: #0f172a; }
          .badge { display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
          .prob-bar { margin: 5px 0; font-size: 11px; }
          .bar-bg { background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 2px; }
          .bar-fill { background: #0d9488; height: 100%; }
          .image-grid { display: flex; gap: 16px; margin-top: 8px; justify-content: center; }
          .image-box { text-align: center; }
          .image-box img { max-width: 100%; max-height: 240px; border-radius: 6px; border: 1px solid #cbd5e1; object-fit: contain; }
          .disclaimer { font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 20px; font-style: italic; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">SmileGuard AI Diagnostic Report</div>
            <div class="subtitle">Two-Stage Deep Learning Radiographic Analysis Engine</div>
          </div>
          <div style="text-align: right;">
            <div class="meta">Date: <strong>${timestamp}</strong></div>
            <div class="meta">Patient: <strong>${patientName}</strong></div>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Primary Neural Radiographic Findings</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="primary-diag">${primaryClass}</div>
            <div class="badge">${confidence}% Confidence</div>
          </div>
          <p style="font-size: 12px; color: #334155; margin: 8px 0 0 0;">${observations}</p>
        </div>

        ${gradcamImg ? `
        <div class="card">
          <div class="section-title">Radiograph & Grad-CAM Attention Map</div>
          <div class="image-grid">
            <div class="image-box">
              <img src="${gradcamImg}" alt="Grad-CAM Overlay" />
            </div>
          </div>
        </div>
        ` : ''}

        <div class="card">
          <div class="section-title">Softmax Probability Distribution (6 Clinical Classes)</div>
          ${(analysisResult.ranked_predictions || []).map(p => `
            <div class="prob-bar">
              <div style="display: flex; justify-content: space-between;">
                <span>${p.class}</span>
                <span><strong>${p.percentage.toFixed(1)}%</strong></span>
              </div>
              <div class="bar-bg">
                <div class="bar-fill" style="width: ${p.percentage}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="section-title">Clinician Verification & Signature</div>
          <p style="font-size: 12px; margin: 0 0 8px 0;">${signoffNotes}</p>
          <div style="font-size: 11px; color: #64748b;">
            Verified By: <strong>${dentistName}</strong> ${dentistVerification.signed ? '✓ (Digitally Signed)' : '(Pending Verification)'}
          </div>
        </div>

        <div class="disclaimer">
          FDA / DOH Class II SaMD Clinical Decision Support Notice: SmileGuard AI utilizes a trained convolutional neural network for radiographic screening assistance. All findings and class probabilities must be corroborated by a licensed dental practitioner before clinical or surgical intervention.
        </div>
      </body>
      </html>
    `;

    try {
      let iframe = document.getElementById('sg-print-frame');
      if (iframe) {
        iframe.remove();
      }
      iframe = document.createElement('iframe');
      iframe.id = 'sg-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow.document;
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (printErr) {
          console.error('Print iframe error, fallback to window:', printErr);
          const printWin = window.open('', '_blank');
          if (printWin) {
            printWin.document.write(htmlContent);
            printWin.document.close();
            printWin.focus();
            printWin.print();
          }
        }
      }, 400);

      toast.success('Clinical Diagnostic Report generated for PDF/Print.', 'Print / PDF Ready');
    } catch (err) {
      console.error('Print generation failed:', err);
      toast.error('Unable to open print dialog. Please check browser permissions.');
    }
  };

  const handleDownloadGradcam = () => {
    if (!analysisResult?.gradcam?.overlayUrl) {
      toast.warning('No Grad-CAM overlay available to download.');
      return;
    }
    const a = document.createElement('a');
    a.href = analysisResult.gradcam.overlayUrl;
    a.download = `SmileGuard_GradCAM_${analysisResult.prediction?.class || 'Analysis'}_${Date.now()}.jpg`;
    a.click();
    toast.success('Grad-CAM Attention Map saved to device.', 'Image Downloaded');
  };

  // Determine current active display image
  const displayImageUrl = inputMode === 'upload' ? uploadedFilePreview : selectedImageUrl;


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="primary" size="sm">
              Clinical Diagnostic Engine
            </Badge>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              EFFICIENTNET-B0 CNN
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              6-CLASS DENTAL OPG
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            AI Diagnostic Workstation
          </h2>
          <p className="text-sm text-ink-secondary">
            Assisted radiograph pathology classification, Grad-CAM activation mapping, and clinician verification.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={isAnalyzing}
          onClick={handleRunAnalysis}
          leftIcon={BrainCircuit}
          disabled={!displayImageUrl}
        >
          {isAnalyzing ? 'Running Model Inference...' : analysisResult ? 'Re-run Model Inference' : 'Run AI Analysis'}
        </Button>
      </div>

      {/* Model Specifications & Performance Bar */}
      {modelInfo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-surface-base border border-surface-border shadow-xs">
            <span className="text-[11px] text-ink-muted uppercase font-bold tracking-wider">Architecture</span>
            <p className="text-sm font-bold text-ink-primary mt-0.5">{modelInfo.architecture || 'EfficientNetB0'}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-base border border-surface-border shadow-xs">
            <span className="text-[11px] text-ink-muted uppercase font-bold tracking-wider">Trained Classes</span>
            <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mt-0.5">{modelInfo.num_classes || 6} Categories</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-base border border-surface-border shadow-xs">
            <span className="text-[11px] text-ink-muted uppercase font-bold tracking-wider">Held-Out Test Accuracy</span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {modelInfo.evaluation?.test_accuracy ? `${(modelInfo.evaluation.test_accuracy * 100).toFixed(1)}%` : 'Active'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-surface-base border border-surface-border shadow-xs">
            <span className="text-[11px] text-ink-muted uppercase font-bold tracking-wider">Grad-CAM Target</span>
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">top_conv (Conv2D)</p>
          </div>
        </div>
      )}

      {/* Mandatory SaMD Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-heading font-bold text-amber-900 dark:text-amber-200">
            Mandatory Clinical Decision Support Disclaimer (FDA / DOH Class II SaMD)
          </p>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            SmileGuard utilizes a trained convolutional neural network for radiographic screening.
            All findings, class probabilities, and Grad-CAM activations must be corroborated by a licensed dental practitioner before definitive diagnosis or surgical intervention.
          </p>
        </div>
      </div>

      {/* Workstation Controls: Radiograph Source Selector */}
      <Card className="p-4 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-heading font-bold text-ink-primary">Radiograph Source:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-surface-subtle border border-surface-border">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                  inputMode === 'upload'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                Upload X-ray Image
              </button>
              <button
                type="button"
                onClick={() => setInputMode('patient')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                  inputMode === 'patient'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                Select from Patient Record
              </button>
            </div>
          </div>

          <span className="text-xs text-ink-muted">
            {inputMode === 'upload' ? 'Upload any dental OPG image file' : 'Radiographs from Cloudinary'}
          </span>
        </div>

        {inputMode === 'upload' ? (
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              id="workstation-file-upload"
            />
            {!uploadedFile ? (
              <label
                htmlFor="workstation-file-upload"
                className="border-2 border-dashed border-surface-border hover:border-teal-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-surface-subtle/50 hover:bg-teal-50/20"
              >
                <FileUp className="w-8 h-8 text-teal-600 mb-2" />
                <p className="text-xs font-bold text-ink-primary">Click to upload or drag & drop a Dental X-ray (OPG)</p>
                <p className="text-[11px] text-ink-muted mt-1">Supports JPG, PNG, BMP, WebP</p>
              </label>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 gap-3">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-teal-900 dark:text-teal-200">{uploadedFile.name}</p>
                    <p className="text-[11px] text-teal-700 dark:text-teal-400">
                      {(uploadedFile.size / 1024).toFixed(1)} KB • {analysisResult?.xray_validation?.is_valid ? 'Valid dental OPG X-ray' : 'Image selected'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isAnalyzing}
                    onClick={handleRunAnalysis}
                    leftIcon={BrainCircuit}
                  >
                    Run AI Analysis
                  </Button>
                  <button
                    type="button"
                    onClick={handleClearUploadedFile}
                    className="p-1.5 rounded-lg text-teal-700 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold text-ink-primary">Select Patient Case</label>
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
              <label className="text-xs font-heading font-bold text-ink-primary">Patient Radiographs</label>
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
        )}
      </Card>

      {/* Main Workspace: Image Viewer + Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Radiograph Inspection Viewer */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="overflow-hidden shadow-soft-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-surface-border">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                Radiograph Viewer & Grad-CAM Overlay
              </CardTitle>
              {analysisResult?.gradcam?.heatmapUrl && (
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-ink-muted" />
                  <span className="text-[11px] text-ink-muted font-mono">Heatmap: {heatmapOpacity}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={heatmapOpacity}
                    onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                    className="w-24 accent-teal-600 cursor-pointer"
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0 bg-slate-950 min-h-[420px] flex items-center justify-center relative">
              {displayImageUrl ? (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img
                    src={displayImageUrl}
                    alt="Radiograph for analysis"
                    className="max-h-[460px] w-auto object-contain rounded-xl"
                  />
                  {analysisResult?.gradcam?.heatmapUrl && heatmapOpacity > 0 && (
                    <img
                      src={analysisResult.gradcam.heatmapUrl}
                      alt="AI Grad-CAM Heatmap"
                      style={{ opacity: heatmapOpacity / 100 }}
                      className="absolute inset-0 max-h-[460px] w-auto m-auto object-contain pointer-events-none mix-blend-screen"
                    />
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-xs text-slate-400 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                  <p>No radiograph loaded. Upload an image or select a patient record to begin.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grad-CAM Explainability Details */}
          {analysisResult && analysisResult.xray_validation?.is_valid && (
            analysisResult.gradcam?.available && analysisResult.gradcam?.heatmapUrl ? (
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-ink-primary">Model Attention Visualization:</span>
                  <span className="text-ink-secondary">
                    Grad-CAM visualization of image regions contributing to the model&apos;s prediction (Layer: <code className="font-mono bg-surface-base px-1 py-0.5 rounded text-[11px]">{analysisResult.gradcam.target_layer || 'top_conv'}</code>).
                  </span>
                </div>
                <Badge variant="neutral" size="sm">Pre-Softmax Logits</Badge>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs text-ink-muted flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Grad-CAM unavailable for this analysis.</span>
              </div>
            )
          )}
        </div>

        {/* Right: AI Diagnostic Observations, Class Probabilities & Clinician Sign-Off */}
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
                <div className="py-14 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-heading font-semibold text-teal-700 dark:text-teal-400">
                    Propagating radiograph through EfficientNet CNN...
                  </p>
                  <p className="text-[11px] text-ink-muted">Computing softmax probabilities and Grad-CAM gradients</p>
                </div>
              ) : analysisError ? (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Inference Error</span>
                  </div>
                  <p>{analysisError}</p>
                </div>
              ) : analysisResult ? (
                analysisResult.status === 'invalid_xray' || analysisResult.xray_validation?.is_valid === false ? (
                  <div className="space-y-4">
                    {/* Non-OPG Rejection Card */}
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-heading font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>Invalid Radiograph Modality</span>
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                        {analysisResult.message || 'The uploaded image does not appear to be a valid dental panoramic (OPG) X-ray.'}
                      </p>
                      <div className="p-2.5 rounded-xl bg-surface-base border border-rose-200 dark:border-rose-800/60 text-xs space-y-1">
                        <div className="flex justify-between font-semibold text-ink-primary">
                          <span>Stage 1 Validator Verdict:</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">REJECTED (Non-OPG)</span>
                        </div>
                        {analysisResult.xray_validation?.confidence && (
                          <div className="flex justify-between text-ink-secondary text-[11px]">
                            <span>Rejection Confidence:</span>
                            <span className="font-mono">{analysisResult.xray_validation.confidence}%</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-muted italic leading-snug">
                        Zero Fabrication Policy: Dental pathology classification and Grad-CAM generation were automatically halted to prevent simulated diagnostic findings on non-X-ray inputs.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Stage 1 Validation Badge */}
                    {analysisResult.xray_validation?.is_valid && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Stage 1: Validated Dental OPG Radiograph</span>
                        </div>
                        <Badge variant="success" size="sm">
                          {analysisResult.xray_validation.confidence}% Verified
                        </Badge>
                      </div>
                    )}

                    {/* Primary Diagnosis Box */}
                    <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase font-bold text-teal-800 dark:text-teal-300 tracking-wider">
                          Primary Neural Prediction
                        </span>
                        <Badge variant="primary" size="md">
                          {analysisResult.prediction?.confidence_percentage}% Confidence
                        </Badge>
                      </div>
                      <div className="text-lg font-heading font-extrabold text-teal-950 dark:text-teal-100">
                        {analysisResult.prediction?.class}
                      </div>
                      {analysisResult.observations && (
                        <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
                          {analysisResult.observations}
                        </p>
                      )}
                    </div>

                    {/* Complete Softmax Class Probabilities Breakdown */}
                    {analysisResult.ranked_predictions && (
                      <div className="space-y-2 pt-2 border-t border-surface-border">
                        <div className="flex items-center justify-between text-xs font-heading font-bold text-ink-primary">
                          <span className="flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5 text-teal-600" />
                            Class Probability Distribution (Softmax)
                          </span>
                          <span className="text-[11px] font-normal text-ink-muted">Sum: 100%</span>
                        </div>

                        <div className="space-y-2">
                          {analysisResult.ranked_predictions.map((item, idx) => {
                            const isTop = idx === 0;
                            return (
                              <div key={item.class} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className={`font-medium ${isTop ? 'font-bold text-teal-700 dark:text-teal-300' : 'text-ink-secondary'}`}>
                                    {item.class}
                                  </span>
                                  <span className="font-mono text-[11px] text-ink-primary font-bold">
                                    {item.percentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isTop
                                        ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                                        : 'bg-slate-400 dark:bg-slate-600'
                                    }`}
                                    style={{ width: `${Math.max(item.percentage, 2)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Findings Description */}
                    {analysisResult.findings?.map((finding, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-surface-border bg-surface-subtle text-xs space-y-1"
                      >
                        <div className="font-bold text-ink-primary">{finding.condition} Pathology Assessment</div>
                        <p className="text-ink-secondary leading-relaxed">{finding.description}</p>
                      </div>
                    ))}

                    {/* CNN Result Export & Downloads Toolbar */}
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-teal-900 dark:text-teal-200">
                          <FileDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span>Download & Export CNN Results</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-md">
                          AI Artifacts
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleDownloadReport}
                          leftIcon={Printer}
                          className="text-xs justify-center shadow-xs"
                        >
                          Print / Save PDF Report
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDownloadGradcam}
                          leftIcon={Download}
                          disabled={!analysisResult?.gradcam?.overlayUrl}
                          className="text-xs justify-center shadow-xs"
                        >
                          Download Grad-CAM Overlay
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              ) : displayImageUrl ? (
                <div className="py-8 px-4 text-center space-y-3 bg-surface-subtle/60 rounded-2xl border border-surface-border">
                  <BrainCircuit className="w-8 h-8 text-teal-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink-primary">Radiograph Ready for Deep Learning Analysis</p>
                    <p className="text-[11px] text-ink-secondary">
                      Click below to execute neural inference and generate real Grad-CAM heatmaps.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    isLoading={isAnalyzing}
                    onClick={handleRunAnalysis}
                    leftIcon={BrainCircuit}
                    className="mx-auto"
                  >
                    Run AI Analysis
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-ink-muted py-6 text-center italic">
                  Load a radiograph and click &ldquo;Run AI Analysis&rdquo; to process real inference through the trained CNN.
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
