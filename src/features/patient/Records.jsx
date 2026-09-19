import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Image as ImageIcon,
  Calendar,
  User,
  ZoomIn,
  Eye,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    async function loadRecords() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const data = await patientService.getRecords(user.id);
        setRecords(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRecords();
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Dental Records & Diagnostic Imaging
        </h2>
        <p className="text-sm text-ink-secondary">
          High-resolution radiographs, OPG scans, clinical tracings, and intraoral photography.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton variant="card" count={3} />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          title="No Dental Records Found"
          description="Your radiographic scans and clinical photos will appear here after your in-clinic diagnostics."
          icon={FolderArchive}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {records.map((rec) => (
            <Card
              key={rec.id}
              hoverEffect
              onClick={() => setSelectedRecord(rec)}
              className="overflow-hidden group"
            >
              {/* Image thumbnail placeholder */}
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img
                  src={rec.imageUrl}
                  alt={rec.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3">
                  <Badge variant="primary" size="sm">
                    {rec.type}
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <span className="font-semibold truncate">{rec.category}</span>
                  <span className="flex items-center gap-1 text-teal-300 bg-slate-900/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </span>
                </div>
              </div>

              <CardContent className="p-5 space-y-2.5">
                <h3 className="font-heading font-bold text-base text-ink-primary line-clamp-1">
                  {rec.title}
                </h3>
                <div className="space-y-1 text-xs text-ink-secondary">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Captured: {formatDate(rec.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Attending: {rec.dentistName}</span>
                  </div>
                </div>
                <p className="text-xs text-ink-muted line-clamp-2 pt-1 border-t border-surface-border">
                  {rec.findings}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord?.title}
        maxWidth="max-w-3xl"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[60vh] flex items-center justify-center">
              <img
                src={selectedRecord.imageUrl}
                alt={selectedRecord.title}
                className="max-h-[55vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-ink-secondary p-3 rounded-2xl bg-surface-50 dark:bg-surface-100/40">
              <div>
                <span className="text-ink-muted block">Date Captured:</span>
                <span className="font-semibold text-ink-primary">{formatDate(selectedRecord.date)}</span>
              </div>
              <div>
                <span className="text-ink-muted block">Attending Practitioner:</span>
                <span className="font-semibold text-ink-primary">{selectedRecord.dentistName}</span>
              </div>
            </div>

            <div className="space-y-1.5 p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60">
              <span className="text-xs font-heading font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Radiological Findings & Clinical Assessment
              </span>
              <p className="text-xs sm:text-sm text-ink-primary leading-relaxed">
                {selectedRecord.findings}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
