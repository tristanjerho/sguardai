import React from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

export function Stepper({ steps = [], currentStep = 1, onStepClick }) {
  const count = steps.length;
  const trackInset = count > 0 ? 50 / count : 0;
  const progressPercent = count > 1 ? ((currentStep - 1) / (count - 1)) * 100 : 100;

  return (
    <div className="w-full py-3 sm:py-4">
      <div className="flex items-start justify-between relative">
        {/* Connecting line anchored vertically to circle center and horizontally between outer circle centers */}
        {count > 1 && (
          <div
            className="absolute top-4 sm:top-5 -translate-y-1/2 h-1 z-0"
            style={{ left: `${trackInset}%`, right: `${trackInset}%` }}
          >
            <div className="w-full h-full bg-surface-200 dark:bg-surface-300 rounded-full" />
            <div
              className="absolute inset-y-0 left-0 bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        )}

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = onStepClick && isCompleted;

          return (
            <div
              key={step.title || index}
              className="relative z-10 flex-1 min-w-0 flex flex-col items-center group px-1"
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(stepNumber)}
                className={clsx(
                  'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-200 border-2 shrink-0',
                  isCompleted && 'bg-teal-600 border-teal-600 text-white shadow-soft',
                  isCurrent && 'bg-surface-card border-teal-600 text-teal-600 ring-4 ring-teal-100 dark:ring-teal-950 shadow-glow',
                  !isCompleted && !isCurrent && 'bg-surface-card border-surface-border text-ink-muted',
                  isClickable && 'hover:scale-105 cursor-pointer'
                )}
                aria-label={`Step ${stepNumber}: ${step.title}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : stepNumber}
              </button>
              <div className="mt-2 text-center w-full min-w-0">
                <span
                  className={clsx(
                    'block text-[11px] sm:text-xs font-heading font-semibold leading-tight break-words',
                    isCurrent ? 'text-teal-700 dark:text-teal-400 font-bold' : isCompleted ? 'text-ink-primary' : 'text-ink-muted'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="hidden sm:block text-[11px] text-ink-muted mt-0.5 leading-snug">
                    {step.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
