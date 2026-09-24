import React from 'react';
import { Link } from 'react-router-dom';
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
  textClassName = '',
}) {
  const sizeMap = {
    xs: { icon: 'w-7 h-7', text: 'text-sm font-bold', gap: 'gap-1.5' },
    sm: { icon: 'w-8 h-8 sm:w-9 sm:h-9', text: 'text-base font-bold', gap: 'gap-2' },
    md: { icon: 'w-10 h-10 sm:w-11 sm:h-11', text: 'text-lg sm:text-xl font-bold', gap: 'gap-2.5' },
    lg: { icon: 'w-12 h-12 sm:w-14 sm:h-14', text: 'text-2xl sm:text-3xl font-bold', gap: 'gap-3' },
    xl: { icon: 'w-16 h-16 sm:w-20 sm:h-20', text: 'text-3xl sm:text-4xl font-bold', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const iconElement = useMascot ? (
    <div className={`${currentSize.icon} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
      <SmileGuardMascot className="w-full h-full object-contain" showShadow={false} />
    </div>
  ) : (
    <img
      src="/logo-icon.png"
      alt="SmileGuard Logo"
      className={`${currentSize.icon} object-contain rounded-xl shadow-soft group-hover:scale-105 transition-transform duration-200`}
    />
  );

  const content = (
    <div className={`inline-flex items-center ${currentSize.gap} group ${className}`}>
      {iconElement}
      {!iconOnly && showText && (
        <span
          className={`font-heading font-extrabold tracking-tight text-teal-700 dark:text-teal-400 ${currentSize.text} ${textClassName}`}
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
