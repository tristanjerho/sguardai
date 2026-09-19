import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-teal-500 flex-shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 dark:border-emerald-800',
    error: 'border-rose-200 dark:border-rose-800',
    warning: 'border-amber-200 dark:border-amber-800',
    info: 'border-teal-200 dark:border-teal-800',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className={clsx(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-surface-card border shadow-soft-lg text-sm text-ink-primary',
        borders[toast.type || 'info']
      )}
      role="alert"
    >
      {icons[toast.type || 'info']}
      <div className="flex-1 pt-0.5">
        {toast.title && <p className="font-heading font-semibold leading-tight">{toast.title}</p>}
        <p className="text-xs text-ink-secondary mt-0.5">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-ink-muted hover:text-ink-primary p-1 rounded-lg hover:bg-surface-100 transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
