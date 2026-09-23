import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMascot } from '../../context/MascotContext';

export function Mascot({
  mood = 'happy',
  size = 'md',
  className = '',
  showSparkles = true,
  forceShow = false,
  onClick,
}) {
  const { showSparky } = useMascot();
  const prefersReducedMotion = useReducedMotion();

  if (!showSparky && !forceShow) return null;

  const sizeDimensions = {
    sm: { width: 56, height: 60, scale: 0.5 },
    md: { width: 100, height: 110, scale: 0.8 },
    lg: { width: 160, height: 175, scale: 1.2 },
    xl: { width: 220, height: 240, scale: 1.6 },
  };

  const { width, height } = sizeDimensions[size] || sizeDimensions.md;

  // Animation variants
  const floatAnimation = prefersReducedMotion
    ? {}
    : {
        y: [0, -6, 0],
        transition: {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };

  const cheerAnimation = prefersReducedMotion
    ? {}
    : {
        y: [0, -10, 0],
        rotate: [-2, 2, -2],
        transition: {
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };

  const waveArmAnimation = prefersReducedMotion
    ? {}
    : {
        rotate: [0, 20, -10, 20, 0],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };

  const brushArmAnimation = prefersReducedMotion
    ? {}
    : {
        x: [0, 6, -4, 6, 0],
        y: [0, -2, 2, -2, 0],
        transition: {
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };

  return (
    <motion.div
      animate={mood === 'cheer' ? cheerAnimation : floatAnimation}
      onClick={onClick}
      className={`inline-block relative select-none cursor-pointer ${className}`}
      style={{ width, height }}
      whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Sparky the Smile Guard (${mood} mood)`}
      role="img"
    >
      <svg
        viewBox="0 0 120 130"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible filter drop-shadow-md"
      >
        <defs>
          {/* Smooth gradients for tooth enamel and shading */}
          <linearGradient id="toothGradient" x1="20" y1="10" x2="100" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.7" stopColor="#F0FDFA" />
            <stop offset="1" stopColor="#CCFBF1" />
          </linearGradient>

          <linearGradient id="shieldGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0D9488" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>

          <radialGradient id="rosyCheek" cx="50%" cy="50%" r="50%">
            <stop stopColor="#FB7185" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="brushHandle" x1="0" y1="0" x2="40" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0D9488" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>

        {/* Sparkles on Cheer */}
        {showSparkles && (mood === 'cheer' || mood === 'happy') && !prefersReducedMotion && (
          <g className="animate-pulse">
            <path
              d="M10 25 Q15 25 15 20 Q15 25 20 25 Q15 25 15 30 Q15 25 10 25Z"
              fill="#F59E0B"
            />
            <path
              d="M102 20 Q106 20 106 16 Q106 20 110 20 Q106 20 106 24 Q106 20 102 20Z"
              fill="#F59E0B"
            />
            <path
              d="M112 55 Q115 55 115 52 Q115 55 118 55 Q115 55 115 58 Q115 55 112 55Z"
              fill="#14B8A6"
            />
          </g>
        )}

        {/* Shadow underneath */}
        <ellipse cx="60" cy="122" rx="34" ry="6" fill="rgba(15, 23, 42, 0.12)" />

        {/* Main Tooth Body Anatomy */}
        <path
          d="M32 20
             C44 14, 52 22, 60 22
             C68 22, 76 14, 88 20
             C102 27, 106 48, 102 70
             C98 88, 90 116, 76 116
             C68 116, 65 96, 60 96
             C55 96, 52 116, 44 116
             C30 116, 22 88, 18 70
             C14 48, 18 27, 32 20 Z"
          fill="url(#toothGradient)"
          stroke="#0D9488"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Enamel Highlight Shine */}
        <path
          d="M32 28 C26 34, 24 48, 25 60 C23 48, 26 34, 34 26 C38 23, 44 24, 48 25 C42 24, 36 24, 32 28 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
        <circle cx="34" cy="38" r="3" fill="#FFFFFF" opacity="0.8" />

        {/* Mini Guard Crest Shield on Forehead */}
        <g transform="translate(52, 28) scale(0.65)">
          <path
            d="M12 2 L22 6 L22 14 C22 20 12 24 12 24 C12 24 2 20 2 14 L2 6 Z"
            fill="url(#shieldGradient)"
            stroke="#0F766E"
            strokeWidth="1.5"
          />
          <path d="M12 6 L12 18 M6 12 L18 12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Rosy Cheeks */}
        <circle cx="36" cy="66" r="8" fill="url(#rosyCheek)" />
        <circle cx="84" cy="66" r="8" fill="url(#rosyCheek)" />

        {/* Mood Expressions: Eyes and Mouth */}
        {mood === 'sleepy' ? (
          <g>
            {/* Sleeping curved eyes */}
            <path d="M34 54 Q42 60 48 54" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M72 54 Q80 60 86 54" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Small 'o' mouth */}
            <ellipse cx="60" cy="72" rx="4" ry="5" fill="#FB7185" stroke="#0F172A" strokeWidth="2" />
            {/* Zzz */}
            <text x="88" y="36" fill="#0D9488" fontSize="14" fontWeight="bold" opacity="0.8">Z</text>
            <text x="96" y="24" fill="#0D9488" fontSize="11" fontWeight="bold" opacity="0.6">z</text>
          </g>
        ) : mood === 'worried' ? (
          <g>
            {/* Worried raised inner eyebrows & eyes */}
            <path d="M34 46 L46 50" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M86 46 L74 50" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="42" cy="55" r="4.5" fill="#0F172A" />
            <circle cx="78" cy="55" r="4.5" fill="#0F172A" />
            {/* Wavy mouth */}
            <path d="M48 74 Q54 68 60 74 Q66 80 72 74" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Sweat drop */}
            <path d="M96 46 C96 46 99 42 99 40 C99 38 97.5 37 96 37 C94.5 37 93 38 93 40 C93 42 96 46 96 46 Z" fill="#38BDF8" />
          </g>
        ) : mood === 'cheer' ? (
          <g>
            {/* Cheering curved squint eyes */}
            <path d="M34 56 Q42 46 50 56" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M70 56 Q78 46 86 56" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Big open smile with tongue */}
            <path
              d="M44 66 Q60 88 76 66 Z"
              fill="#E11D48"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M52 76 Q60 70 68 76 Q60 84 52 76 Z"
              fill="#FB7185"
            />
            {/* Top teeth shimmer */}
            <path d="M47 66 Q60 70 73 66" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : (
          /* Happy / Standard / Wave / Brushing Face */
          <g>
            {/* Big Friendly Anime Eyes */}
            <ellipse cx="42" cy="54" rx="5" ry="6" fill="#0F172A" />
            <circle cx="44" cy="52" r="2" fill="#FFFFFF" />
            <circle cx="40" cy="56" r="1" fill="#FFFFFF" />

            <ellipse cx="78" cy="54" rx="5" ry="6" fill="#0F172A" />
            <circle cx="80" cy="52" r="2" fill="#FFFFFF" />
            <circle cx="76" cy="56" r="1" fill="#FFFFFF" />

            {/* Cheerful wide smile */}
            <path
              d="M46 66 Q60 82 74 66"
              stroke="#0F172A"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* Arms & Interactive Accessories */}
        {mood === 'cheer' ? (
          <g>
            {/* Left arm up */}
            <path d="M22 68 Q10 50 14 36" stroke="#0D9488" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="14" cy="36" r="4.5" fill="#F0FDFA" stroke="#0D9488" strokeWidth="2" />
            {/* Right arm up */}
            <path d="M98 68 Q110 50 106 36" stroke="#0D9488" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="106" cy="36" r="4.5" fill="#F0FDFA" stroke="#0D9488" strokeWidth="2" />
          </g>
        ) : mood === 'wave' ? (
          <g>
            {/* Left arm resting */}
            <path d="M20 70 Q12 80 18 88" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Right arm waving with motion */}
            <motion.g animate={waveArmAnimation} style={{ originX: '98px', originY: '68px' }}>
              <path d="M98 68 Q114 55 110 40" stroke="#0D9488" strokeWidth="4" strokeLinecap="round" fill="none" />
              <circle cx="110" cy="40" r="5" fill="#F0FDFA" stroke="#0D9488" strokeWidth="2" />
            </motion.g>
          </g>
        ) : mood === 'brushing' ? (
          <g>
            {/* Left arm resting */}
            <path d="M20 70 Q14 80 20 88" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Right arm holding toothbrush */}
            <motion.g animate={brushArmAnimation}>
              <path d="M96 70 Q84 76 74 72" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              {/* Toothbrush handle */}
              <rect x="58" y="60" width="36" height="5" rx="2.5" transform="rotate(-15 58 60)" fill="url(#brushHandle)" stroke="#0F766E" strokeWidth="1" />
              {/* Toothbrush bristles */}
              <rect x="52" y="55" width="12" height="6" rx="1.5" transform="rotate(-15 52 55)" fill="#FFFFFF" stroke="#0D9488" strokeWidth="1" />
              {/* Toothpaste bubbles */}
              <circle cx="48" cy="56" r="4" fill="#67E8F9" opacity="0.9" />
              <circle cx="54" cy="51" r="3" fill="#A5F3FC" opacity="0.9" />
              <circle cx="44" cy="52" r="2.5" fill="#FFFFFF" />
            </motion.g>
          </g>
        ) : (
          <g>
            {/* Standard cute resting arms */}
            <path d="M20 70 Q12 78 18 84" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M100 70 Q108 78 102 84" stroke="#0D9488" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}
