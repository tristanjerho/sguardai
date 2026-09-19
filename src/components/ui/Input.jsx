import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Input = React.forwardRef(function Input(
  {
    label,
    error,
    helperText,
    type = 'text',
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    className = '',
    id,
    disabled = false,
    required = false,
    ...props
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {LeftIcon && (
          <div className="absolute left-3.5 text-ink-muted pointer-events-none flex items-center">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          disabled={disabled}
          required={required}
          className={twMerge(
            clsx(
              'w-full bg-surface-card border rounded-xl py-2.5 px-3.5 text-sm text-ink-primary placeholder:text-ink-muted/70 transition-all duration-200 outline-none',
              'focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500',
              'disabled:bg-surface-100 disabled:text-ink-muted disabled:cursor-not-allowed',
              error
                ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-surface-border hover:border-surface-300 dark:hover:border-surface-200',
              LeftIcon && 'pl-10',
              (RightIcon || isPassword) && 'pr-10',
              className
            )
          )}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-ink-muted hover:text-ink-primary p-1 rounded-md transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : (
          RightIcon && (
            <div className="absolute right-3.5 text-ink-muted pointer-events-none flex items-center">
              <RightIcon className="w-4 h-4" />
            </div>
          )
        )}
      </div>

      {error ? (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-ink-muted">{helperText}</p>
      ) : null}
    </div>
  );
});
