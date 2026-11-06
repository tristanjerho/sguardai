import React from 'react';

/**
 * SmileGuard Mascot SVG Component
 * High-definition, scalable mascot of the pristine white dental guardian hugging a happy tooth with sparkles.
 *
 * @param {Object} props
 * @param {number|string} [props.size=80] - Size in pixels or Tailwind classes
 * @param {boolean} [props.animated=true] - Adds subtle floating/hover animation
 * @param {boolean} [props.showBackground=false] - Whether to render canvas gradient background
 * @param {boolean} [props.showShadow=true] - Whether to show the ground drop shadow
 * @param {boolean} [props.showSparkles=true] - Whether to show top sparkles
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function SmileGuardMascot({
  size,
  animated = false,
  showBackground = false,
  showShadow = true,
  showSparkles = true,
  tight = true,
  className = '',
  viewBox: customViewBox,
  ...props
}) {
  const isNumeric = typeof size === 'number';
  const hasStringSize = typeof size === 'string' && (size.endsWith('px') || size.endsWith('%') || size.endsWith('rem') || size.endsWith('em'));

  // Only apply inline style if an explicit size is provided or if no sizing class exists in className
  const style = isNumeric
    ? { width: size, height: size }
    : hasStringSize
    ? { width: size, height: size }
    : (size === null || size === false || size === 'auto')
    ? undefined
    : (size === undefined && !className.includes('w-') && !className.includes('h-'))
    ? { width: 80, height: 80 }
    : undefined;

  // Compute tight viewBox to eliminate excess whitespace around the character
  let computedViewBox = '0 0 800 800';
  if (customViewBox) {
    computedViewBox = customViewBox;
  } else if (showBackground) {
    computedViewBox = '0 0 800 800';
  } else if (tight) {
    if (showShadow) {
      computedViewBox = '210 125 380 590';
    } else {
      computedViewBox = '220 125 360 560';
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={computedViewBox}
      style={style}
      className={`inline-block select-none ${animated ? 'hover:scale-105 transition-transform duration-300' : ''} ${className}`}
      {...props}
    >
      <defs>
        {/* Background Gradient */}
        <radialGradient id="sgBgGrad" cx="50%" cy="50%" r="75%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#FCFCF9" />
          <stop offset="100%" stopColor="#F2F3EC" />
        </radialGradient>

        {/* Main Body Gradient (Pristine Pearly White with Soft Enamel Shading) */}
        <linearGradient id="sgBodyGrad" x1="25%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor="#FAFCFD" />
          <stop offset="70%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Body Specular Highlight Overlay */}
        <radialGradient id="sgBodyHighlight" cx="35%" cy="25%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Inner Body Shadow for soft porcelain depth */}
        <radialGradient id="sgBodyShadow" cx="50%" cy="88%" r="48%">
          <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.25" />
          <stop offset="60%" stopColor="#CBD5E1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Arm Gradients (Clean Pearl White with Soft Shading) */}
        <linearGradient id="sgArmGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        <linearGradient id="sgArmGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Little Tooth Gradient (Enamel White with subtle mint glow) */}
        <linearGradient id="sgToothGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="80%" stopColor="#F0FDFA" />
          <stop offset="100%" stopColor="#CCFBF1" />
        </linearGradient>

        {/* Tooth Shadow */}
        <radialGradient id="sgToothShadow" cx="50%" cy="90%" r="50%">
          <stop offset="0%" stopColor="#0D9488" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0" />
        </radialGradient>

        {/* Ground Drop Shadow */}
        <radialGradient id="sgDropShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#334155" stopOpacity="0.18" />
          <stop offset="60%" stopColor="#334155" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#334155" stopOpacity="0" />
        </radialGradient>

        {/* Tooth Glow */}
        <filter id="sgGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Sparkle Mint & Cyan Gradient */}
        <linearGradient id="sgSparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="50%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        {/* Eye Shine */}
        <radialGradient id="sgEyeGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>
      </defs>

      {/* Optional Background Canvas */}
      {showBackground && <rect width="800" height="800" rx="160" fill="url(#sgBgGrad)" />}

      {/* Ground Shadow */}
      {showShadow && <ellipse cx="400" cy="670" rx="170" ry="28" fill="url(#sgDropShadow)" />}

      {/* MAIN CHARACTER GROUP */}
      <g transform="translate(0, 20)">
        {/* SPARKLES ABOVE HEAD */}
        {showSparkles && (
          <g id="sparkles">
            <path
              d="M 400 120 Q 400 145 425 145 Q 400 145 400 170 Q 400 145 375 145 Q 400 145 400 120 Z"
              fill="url(#sgSparkleGrad)"
              filter="url(#sgGlow)"
            />
            <path
              d="M 330 155 Q 330 170 345 170 Q 330 170 330 185 Q 330 170 315 170 Q 330 170 330 155 Z"
              fill="url(#sgSparkleGrad)"
              transform="rotate(-12, 330, 170)"
            />
            <path
              d="M 470 155 Q 470 170 485 170 Q 470 170 470 185 Q 470 170 455 170 Q 470 170 470 155 Z"
              fill="url(#sgSparkleGrad)"
              transform="rotate(12, 470, 170)"
            />
            <path
              d="M 290 190 Q 290 200 300 200 Q 290 200 290 210 Q 290 200 280 200 Q 290 200 290 190 Z"
              fill="#2DD4BF"
              opacity="0.85"
            />
            <path
              d="M 510 190 Q 510 200 520 200 Q 510 200 510 210 Q 510 200 500 200 Q 510 200 510 190 Z"
              fill="#2DD4BF"
              opacity="0.85"
            />
          </g>
        )}

        {/* BASE WHITE BODY (Cute Capsule Shield Shape with Delicate Definition) */}
        <g id="body">
          <path
            d="
              M 260, 340 
              C 260, 210  540, 210  540, 340
              C 540, 470  530, 560  470, 620
              C 440, 650  415, 630  400, 595
              C 385, 630  360, 650  330, 620
              C 270, 560  260, 470  260, 340 Z"
            fill="url(#sgBodyGrad)"
            stroke="rgba(148, 163, 184, 0.45)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="
              M 260, 340 
              C 260, 210  540, 210  540, 340
              C 540, 470  530, 560  470, 620
              C 440, 650  415, 630  400, 595
              C 385, 630  360, 650  330, 620
              C 270, 560  260, 470  260, 340 Z"
            fill="url(#sgBodyShadow)"
          />
          <path
            d="
              M 260, 340 
              C 260, 210  540, 210  540, 340
              C 540, 470  530, 560  470, 620
              C 440, 650  415, 630  400, 595
              C 385, 630  360, 650  330, 620
              C 270, 560  260, 470  260, 340 Z"
            fill="url(#sgBodyHighlight)"
          />
        </g>

        {/* FACIAL FEATURES */}
        <g id="face">
          {/* Left Eye */}
          <g transform="translate(330, 340)">
            <ellipse cx="0" cy="0" rx="20" ry="24" fill="url(#sgEyeGrad)" />
            <circle cx="-6" cy="-8" r="9" fill="#FFFFFF" />
            <circle cx="7" cy="8" r="4" fill="#FFFFFF" />
          </g>

          {/* Right Eye */}
          <g transform="translate(470, 340)">
            <ellipse cx="0" cy="0" rx="20" ry="24" fill="url(#sgEyeGrad)" />
            <circle cx="-6" cy="-8" r="9" fill="#FFFFFF" />
            <circle cx="7" cy="8" r="4" fill="#FFFFFF" />
          </g>

          {/* Rosy Blush Cheeks */}
          <ellipse cx="305" cy="370" rx="24" ry="14" fill="#FF76A0" opacity="0.5" filter="url(#sgGlow)" />
          <ellipse cx="495" cy="370" rx="24" ry="14" fill="#FF76A0" opacity="0.5" filter="url(#sgGlow)" />

          {/* Cute Happy Smile */}
          <path
            d="M 370 365 Q 400 395 430 365"
            fill="none"
            stroke="#0F172A"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        </g>

        {/* HUGGING ARMS AND LITTLE TOOTH */}
        <g id="holding-tooth">
          <ellipse cx="400" cy="525" rx="55" ry="20" fill="#64748B" opacity="0.15" />

          {/* Back of Left Arm */}
          <path
            d="M 262 440 C 230 450 240 540 315 540 C 335 540 350 520 345 500 C 340 480 300 460 262 440 Z"
            fill="url(#sgArmGradLeft)"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="2.5"
          />

          {/* Back of Right Arm */}
          <path
            d="M 538 440 C 570 450 560 540 485 540 C 465 540 450 520 455 500 C 460 480 500 460 538 440 Z"
            fill="url(#sgArmGradRight)"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="2.5"
          />

          {/* LIL' HUGGED TOOTH */}
          <g id="little-tooth" transform="translate(400, 500)">
            <path
              d="
                M -35, -35 
                C -45, -35 -50, -10 -45, 10
                C -40, 30 -30, 45 -22, 45
                C -15, 45 -12, 30 0, 25
                C 12, 30 15, 45 22, 45
                C 30, 45 40, 30 45, 10
                C 50, -10 45, -35 35, -35
                C 20, -35 15, -25 0, -25
                C -15, -25 -20, -35 -35, -35 Z"
              fill="url(#sgToothGrad)"
              stroke="#0D9488"
              strokeWidth="2.5"
            />

            <path
              d="M -30 -25 C -20 -25 -15 -18 0 -18 C 15 -18 20 -25 30 -25 C 38 -25 40 -10 38 5 C 30 -10 15 -10 0 -10 C -15 -10 -30 -10 -38 5 C -40 -10 -38 -25 -30 -25 Z"
              fill="#FFFFFF"
              opacity="0.85"
            />

            <path
              d="
                M -45, 10
                C -40, 30 -30, 45 -22, 45
                C -15, 45 -12, 30 0, 25
                C 12, 30 15, 45 22, 45
                C 30, 45 40, 30 45, 10
                Z"
              fill="url(#sgToothShadow)"
            />

            <circle cx="-12" cy="-2" r="3.5" fill="#0D9488" />
            <circle cx="12" cy="-2" r="3.5" fill="#0D9488" />
            <path d="M -5 6 Q 0 11 5 6" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" />
          </g>

          {/* Front Left Paws/Hands Overlay for Hugging Depth */}
          <path
            d="M 315 520 C 335 520 355 510 355 490 C 355 470 335 475 320 485 C 305 495 300 520 315 520 Z"
            fill="#CBD5E1"
            opacity="0.25"
          />
          <path
            d="M 260 435 C 240 480 280 545 325 530 C 350 522 355 490 338 480 C 310 465 285 450 260 435 Z"
            fill="url(#sgArmGradLeft)"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="2.5"
          />

          {/* Front Right Paws/Hands Overlay */}
          <path
            d="M 540 435 C 560 480 520 545 475 530 C 450 522 445 490 462 480 C 490 465 515 450 540 435 Z"
            fill="url(#sgArmGradRight)"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="2.5"
          />

          {/* Highlights on Shoulders/Arms */}
          <ellipse
            cx="275"
            cy="455"
            rx="8"
            ry="18"
            fill="#FFFFFF"
            opacity="0.6"
            transform="rotate(-30, 275, 455)"
          />
          <ellipse
            cx="525"
            cy="455"
            rx="8"
            ry="18"
            fill="#FFFFFF"
            opacity="0.6"
            transform="rotate(30, 525, 455)"
          />
        </g>
      </g>
    </svg>
  );
}
