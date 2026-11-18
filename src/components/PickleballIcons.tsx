import React from 'react';

interface IconProps {
  className?: string;
}

/** Openline Court primary brand emblem: court kitchen + net + perforated pickleball */
export const PickleballLogoMark: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    className={className}
    viewBox="0 0 28 28"
    fill="none"
    shapeRendering="geometricPrecision"
    aria-hidden="true"
  >
    <rect x="2.5" y="4.5" width="23" height="19" rx="3" stroke="currentColor" strokeWidth="1.9" />
    <line x1="14" y1="4.5" x2="14" y2="23.5" stroke="#FBCFE8" strokeWidth="2" />
    <line x1="9" y1="4.5" x2="9" y2="23.5" stroke="currentColor" strokeWidth="1.35" strokeOpacity="0.6" />
    <line x1="19" y1="4.5" x2="19" y2="23.5" stroke="currentColor" strokeWidth="1.35" strokeOpacity="0.6" />
    <circle cx="20.5" cy="9.5" r="2.75" fill="#FACC15" stroke="#831843" strokeWidth="1.1" />
  </svg>
);

/** Clean perforated pickleball icon */
export const PickleballBallIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    shapeRendering="geometricPrecision"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="9.2" cy="9" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="8.7" r="1.1" fill="currentColor" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" />
    <circle cx="8.8" cy="14.6" r="1.1" fill="currentColor" />
    <circle cx="14.8" cy="14.8" r="1.1" fill="currentColor" />
  </svg>
);

/** Minimalist pickleball paddle & ball icon */
export const PickleballPaddleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    shapeRendering="geometricPrecision"
    aria-hidden="true"
  >
    <path
      d="M7.5 3.5h7a3.5 3.5 0 0 1 3.5 3.5v4.8a4.5 4.5 0 0 1-4.5 4.5h-5A4.5 4.5 0 0 1 4 11.8V7a3.5 3.5 0 0 1 3.5-3.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M11 16.3V21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="19" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/** Subtle pickleball court-line decorative watermark for headers */
export const CourtLinesBackdrop: React.FC<IconProps> = ({ className = 'w-full h-full' }) => (
  <svg
    className={className}
    viewBox="0 0 400 180"
    fill="none"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <rect x="20" y="16" width="360" height="148" rx="6" stroke="currentColor" strokeWidth="1.5" />
    <line x1="200" y1="16" x2="200" y2="164" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
    <line x1="140" y1="16" x2="140" y2="164" stroke="currentColor" strokeWidth="1.25" />
    <line x1="260" y1="16" x2="260" y2="164" stroke="currentColor" strokeWidth="1.25" />
    <line x1="20" y1="90" x2="140" y2="90" stroke="currentColor" strokeWidth="1.25" />
    <line x1="260" y1="90" x2="380" y2="90" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);
