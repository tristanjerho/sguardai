import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  isOpen,
  open,
  onClose,
  title,
  description,
  children,
  size,
  maxWidth,
  showCloseButton = true,
  className = '',
  exitImmediately = false,
}) {
  const modalOpen = Boolean(isOpen ?? open);
  const resolvedMaxWidth = maxWidth || (size && SIZE_MAP[size]) || 'max-w-lg';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOpen) {
        onClose?.();
      }
    };
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen, onClose]);

  return (
    <AnimatePresence>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: exitImmediately ? 0 : 0.2 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Box */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 10,
              transition: exitImmediately ? { duration: 0 } : undefined,
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={twMerge(
              clsx(
                'relative w-full z-10 bg-surface-card border border-surface-border rounded-2xl sm:rounded-3xl shadow-soft-lg overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col',
                resolvedMaxWidth,
                className
              )
            )}
          >
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-3 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-surface-border shrink-0">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h3 id="modal-title" className="text-base sm:text-xl font-heading font-bold text-ink-primary break-words">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs sm:text-sm text-ink-secondary mt-1 break-words">{description}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 -mr-1.5 -mt-1 rounded-xl text-ink-muted hover:text-ink-primary hover:bg-surface-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
