import React from 'react';

export function ProgressRing({
  percentage = 0,
  size = 140,
  strokeWidth = 10,
  label = 'Complete',
  sublabel,
  color = 'teal',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  const strokeColors = {
    teal: 'stroke-teal-500',
    orange: 'stroke-orange-500',
    blue: 'stroke-blue-500',
  };

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 origin-center"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-surface-200 dark:text-surface-300"
        />
        {/* Animated Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className={`${strokeColors[color] || 'stroke-teal-500'} transition-all duration-700 ease-out`}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary">
          {Math.round(clampedPercentage)}%
        </span>
        <span className="text-[11px] font-semibold text-ink-secondary mt-0.5">
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] text-ink-muted">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
