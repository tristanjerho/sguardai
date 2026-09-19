import React from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

export function Stepper({ steps, currentStep, onStepClick }) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-surface-200 dark:bg-surface-300 w-full z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-teal-500 transition-all duration-300 z-0"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = onStepClick && isCompleted;

          return (
            <div
              key={step.title || index}
              className="relative z-10 flex flex-col items-center group"
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(stepNumber)}
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 border-2',
                  isCompleted && 'bg-teal-600 border-teal-600 text-white shadow-soft',
                  isCurrent && 'bg-surface-card border-teal-600 text-teal-600 ring-4 ring-teal-100 dark:ring-teal-950 shadow-glow',
                  !isCompleted && !isCurrent && 'bg-surface-card border-surface-border text-ink-muted',
                  isClickable && 'hover:scale-105 cursor-pointer'
                )}
                aria-label={`Step ${stepNumber}: ${step.title}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : stepNumber}
              </button>
              <div className="mt-2 text-center">
                <span
                  className={clsx(
                    'block text-xs font-heading font-semibold whitespace-nowrap',
                    isCurrent ? 'text-teal-700 dark:text-teal-400 font-bold' : isCompleted ? 'text-ink-primary' : 'text-ink-muted'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="hidden sm:block text-[11px] text-ink-muted mt-0.5">
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
