import React from 'react';

interface FacebookLogoProps {
  className?: string;
}

export const FacebookLogo: React.FC<FacebookLogoProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    shapeRendering="geometricPrecision"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="11" fill="#1877F2" />
    <path
      fill="#FFFFFF"
      d="M15.4 12.7l.45-2.9h-2.8V7.92c0-.8.39-1.57 1.64-1.57h1.27V3.88s-1.15-.2-2.25-.2c-2.3 0-3.8 1.39-3.8 3.91V9.8H7.36v2.9h2.55v7.02c.51.08 1.04.12 1.57.12s1.06-.04 1.57-.12V12.7h2.35z"
    />
  </svg>
);
