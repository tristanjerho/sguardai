import React, { useState, useEffect, useRef } from 'react';
import {
  FolderArchive,
  Image as ImageIcon,
  Calendar,
  User,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Eye,
  FileText,
  Sparkles,
  Download,
  ExternalLink,
  Contrast,
  Maximize2,
  Move,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { patientService } from '../../services/patientService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatters';

export function Records() {
  const { user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Interactive Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isInverted, setIsInverted] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const loadRecords = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await patientService.getRecords(user.id);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load patient records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [user?.id]);

  // Reset zoom & pan when opening a new record
  const handleOpenRecord = (rec) => {
    setSelectedRecord(rec);
    setZoom(1);
    setRotation(0);
    setIsInverted(false);
    setIsHighContrast(false);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
    setIsInverted(false);
    setIsHighContrast(false);
    setPan({ x: 0, y: 0 });
  };

  // Pan / Drag handlers
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
            Dental Records & Diagnostic Imaging
          </h2>
          <p className="text-sm text-ink-secondary">
            High-resolution radiographs, OPG scans, clinical tracings, and intraoral photography.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" size="md">
            Clinical Verified Scans
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton variant="card" count={3} />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          title="No Dental Records Found"
          description="Your radiographic scans and clinical photos will appear here once uploaded by your attending dental practitioner."
          icon={FolderArchive}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.map((rec) => (
            <Card
              key={rec.id}
              hoverEffect
              onClick={() => handleOpenRecord(rec)}
              className="overflow-hidden group cursor-pointer"
            >
              {/* Image thumbnail placeholder */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img
                  src={rec.secureUrl || rec.imageUrl}
                  alt={rec.title || rec.type}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3">
                  <Badge variant="primary" size="sm">
                    {rec.type}
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-semibold truncate">{rec.type}</span>
                  <span className="flex items-center gap-1 text-teal-300 bg-slate-900/60 px-2 py-0.5 rounded-md backdrop-blur-sm group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                    View & Zoom
                  </span>
                </div>
              </div>

              <CardContent className="p-5 space-y-2.5">
                <h3 className="font-heading font-bold text-base text-ink-primary line-clamp-1">
                  {rec.title || `${rec.type} Diagnostic Image`}
                </h3>
                <div className="space-y-1 text-xs text-ink-secondary">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Uploaded: {formatDate(rec.createdAt)}</span>
                  </div>
                  {rec.toothNumbers?.length > 0 && (
                    <div className="text-teal-700 dark:text-teal-400 font-mono text-[11px]">
                      Teeth: #{rec.toothNumbers.join(', #')}
                    </div>
                  )}
                </div>
                {rec.notes && (
                  <p className="text-xs text-ink-muted line-clamp-2 pt-1 border-t border-surface-border">
                    {rec.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Interactive Medical Lightbox Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `${selectedRecord.type} Diagnostic Scan Viewer` : ''}
        maxWidth="max-w-5xl"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={ZoomIn}
                  onClick={handleZoomIn}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  Zoom In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={ZoomOut}
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="h-8 px-2.5 text-xs font-semibold"
                >
                  Zoom Out
                </Button>
                <span className="px-2 py-1 bg-surface-base border border-surface-border rounded-lg text-ink-primary font-mono text-xs font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={RotateCw}
                  onClick={handleRotate}
                  className="h-8 px-2.5 text-xs font-semibold"
                  title="Rotate 90 degrees"
                >
                  Rotate
                </Button>
                <Button
                  variant={isHighContrast ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={Contrast}
                  onClick={() => setIsHighContrast(!isHighContrast)}
                  className="h-8 px-2.5 text-xs font-semibold"
                  title="Toggle High Contrast for Bone/Teeth Details"
                >
                  Contrast
                </Button>
                <Button
                  variant={isInverted ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsInverted(!isInverted)}
                  className="h-8 px-2.5 text-xs font-semibold"
                  title="Invert negative colors"
                >
                  Invert
                </Button>
                {(zoom > 1 || rotation !== 0 || isInverted || isHighContrast) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={RefreshCw}
                    onClick={handleResetView}
                    className="h-8 px-2 text-xs text-ink-secondary hover:text-ink-primary"
                  >
                    Reset
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedRecord.secureUrl || selectedRecord.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-base border border-surface-border text-ink-primary hover:text-teal-600 hover:border-teal-500 text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Resolution
                </a>
              </div>
            </div>

            {/* Main Interactive Zoomable Viewport */}
            <div
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 h-[65vh] flex items-center justify-center select-none ${
                zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  filter: `${isInverted ? 'invert(1) ' : ''}${isHighContrast ? 'contrast(1.6) brightness(1.1) ' : ''}`,
                  transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className="max-h-[60vh] max-w-[90vw] flex items-center justify-center origin-center"
              >
                <img
                  src={selectedRecord.secureUrl || selectedRecord.imageUrl}
                  alt={selectedRecord.type}
                  draggable={false}
                  className="max-h-[58vh] w-auto object-contain rounded-xl shadow-2xl pointer-events-none"
                />
              </div>

              {/* Pan Navigation Hint */}
              {zoom > 1 && (
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-teal-300 text-[11px] px-3 py-1.5 rounded-xl border border-slate-700/60 flex items-center gap-1.5 pointer-events-none">
                  <Move className="w-3.5 h-3.5 text-teal-400" />
                  Click & drag to pan around image
                </div>
              )}

              {/* Type Badge */}
              <div className="absolute top-3 right-3 pointer-events-none">
                <span className="bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-xl border border-slate-700/60">
                  {selectedRecord.type}
                </span>
              </div>
            </div>

            {/* Diagnostic Information & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink-secondary p-3.5 rounded-2xl bg-surface-subtle border border-surface-border">
              <div>
                <span className="text-ink-muted block">Date Uploaded:</span>
                <span className="font-semibold text-ink-primary">{formatDate(selectedRecord.createdAt)}</span>
              </div>
              <div>
                <span className="text-ink-muted block">Diagnostic Category:</span>
                <span className="font-semibold text-ink-primary">{selectedRecord.type}</span>
              </div>
            </div>

            {selectedRecord.notes && (
              <div className="space-y-1.5 p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60">
                <span className="text-xs font-heading font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Clinical Findings & Attending Practitioner Notes
                </span>
                <p className="text-xs sm:text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
                  {selectedRecord.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
