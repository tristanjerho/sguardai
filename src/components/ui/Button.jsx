import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-teal-600 hover:bg-teal-700 text-white shadow-soft hover:shadow-glow focus-visible:ring-teal-500 dark:bg-gradient-to-r dark:from-[#83A6CE] dark:to-[#C48CB3] dark:hover:from-[#95B5DC] dark:hover:to-[#D19EC2] dark:text-[#0B1B32] dark:font-bold dark:shadow-[0_0_20px_rgba(131,166,206,0.3)]',
    accent:
      'bg-orange-500 hover:bg-orange-600 text-white shadow-soft hover:shadow-glow-accent focus-visible:ring-orange-500 dark:bg-gradient-to-r dark:from-[#C48CB3] dark:to-[#E5C9D7] dark:hover:from-[#D19EC2] dark:hover:to-[#F0DCE6] dark:text-[#0B1B32] dark:font-bold dark:shadow-[0_0_20px_rgba(196,140,179,0.35)]',
    secondary:
      'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 dark:bg-[#26415E]/80 dark:hover:bg-[#26415E] dark:text-[#E5C9D7] dark:border-[#83A6CE]/30 dark:shadow-sm',
    outline:
      'border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-slate-700 dark:border-[#83A6CE]/35 dark:text-[#E5C9D7] dark:hover:bg-[#26415E]/60 dark:hover:border-[#C48CB3]/60 dark:hover:text-white',
    ghost:
      'text-slate-600 hover:text-teal-600 hover:bg-teal-50/60 dark:text-[#83A6CE] dark:hover:text-[#E5C9D7] dark:hover:bg-[#26415E]/50',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-soft focus-visible:ring-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 dark:shadow-[0_0_20px_rgba(225,29,72,0.3)]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
    icon: 'p-2 rounded-xl',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        LeftIcon && <LeftIcon className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{children}</span>
      {!isLoading && RightIcon && <RightIcon className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}
