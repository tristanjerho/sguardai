import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useMascot } from '../../context/MascotContext';

export function MascotBubble({
  title,
  message,
  actionLabel,
  onAction,
  onClose,
  className = '',
  badge = 'Sparky Tip',
}) {
  const { showSparky } = useMascot();

  if (!showSparky || !message) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className={`relative bg-surface-card border border-teal-200 dark:border-teal-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-soft-sm ${className}`}
      >
        {/* Pointer bubble arrow */}
        <div className="hidden sm:block absolute -left-2.5 top-8 w-4 h-4 bg-surface-card border-l border-b border-teal-200 dark:border-teal-800/80 transform rotate-45" />

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {badge && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                {badge}
              </span>
            )}
            {title && (
              <h4 className="font-heading font-bold text-sm sm:text-base text-ink-primary">
                {title}
              </h4>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink-primary p-1 rounded-lg hover:bg-surface-100 transition-colors -mr-1 -mt-1"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-xs sm:text-sm text-ink-secondary mt-2 leading-relaxed">
          {message}
        </p>

        {actionLabel && onAction && (
          <div className="mt-3.5 pt-2 border-t border-surface-border/50 flex justify-end">
            <button
              onClick={onAction}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              <span>{actionLabel}</span>
              <span>→</span>
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
