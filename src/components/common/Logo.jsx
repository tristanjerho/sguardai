import React from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from 'tailwind-merge';
import { SmileGuardMascot } from './SmileGuardMascot';

/**
 * Standardized SmileGuard Brand Logo Component
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [props.size='md']
 * @param {boolean} [props.showText=true]
 * @param {boolean} [props.iconOnly=false]
 * @param {boolean} [props.asLink=true]
 * @param {boolean} [props.useMascot=true]
 * @param {string} [props.to='/']
 * @param {string} [props.className='']
 * @param {string} [props.iconClassName='']
 * @param {string} [props.textClassName='']
 */
export function Logo({
  size = 'md',
  showText = true,
  iconOnly = false,
  asLink = true,
  useMascot = true,
  to = '/',
  className = '',
  iconClassName = '',
  textClassName = '',
}) {
  const sizeMap = {
    xs: { icon: 'w-6 h-6', text: 'text-xs font-bold', gap: 'gap-1.5' },
    sm: { icon: 'w-7 h-7 sm:w-8 sm:h-8', text: 'text-sm font-bold', gap: 'gap-2' },
    md: { icon: 'w-8 h-8 sm:w-9 sm:h-9', text: 'text-lg sm:text-xl font-bold', gap: 'gap-2.5' },
    lg: { icon: 'w-11 h-11 sm:w-12 sm:h-12', text: 'text-2xl sm:text-3xl font-bold', gap: 'gap-3' },
    xl: { icon: 'w-16 h-16 sm:w-20 sm:h-20', text: 'text-3xl sm:text-4xl font-bold', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const iconClasses = twMerge(currentSize.icon, iconClassName);

  const iconElement = useMascot ? (
    <div className={`${iconClasses} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}>
      <SmileGuardMascot className="w-full h-full object-contain" showShadow={false} size={null} />
    </div>
  ) : (
    <img
      src="/logo-icon.png"
      alt="SmileGuard Logo"
      className={`${iconClasses} object-contain rounded-xl shadow-soft shrink-0 group-hover:scale-105 transition-transform duration-200`}
    />
  );

  const content = (
    <div className={`inline-flex items-center ${currentSize.gap} group ${className}`}>
      {iconElement}
      {!iconOnly && showText && (
        <span
          className={`font-heading font-extrabold tracking-tight text-teal-700 dark:text-teal-400 ${currentSize.text} ${textClassName} truncate max-w-[125px] xs:max-w-none`}
        >
          SmileGuard
        </span>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link to={to} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
