import React from 'react';

interface OmalLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
}

export const OmalLogo: React.FC<OmalLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const isLight = variant === 'light'; // Light variant for dark backgrounds (white text)

  const dimensions = {
    sm: { icon: 32, text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 46, text: 'text-xl', sub: 'text-[10px]' },
    lg: { icon: 56, text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 72, text: 'text-3xl', sub: 'text-sm' },
  }[size];

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Precision SVG Vector Emblem: House with 4-Pane Window + Diagonal Hammer Roof */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={dimensions.icon}
          height={dimensions.icon}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          {/* Outer Roof Gables (Gold) */}
          <path
            d="M50 12 L14 44 L20 50 L50 24 L80 50 L86 44 Z"
            fill="#F59E0B"
          />

          {/* Left House Body with Window Frame */}
          <rect x="22" y="44" width="28" height="42" rx="2" fill={isLight ? '#0F1D36' : '#1E293B'} stroke="#F59E0B" strokeWidth="3" />
          
          {/* 4-Pane Window (Gold Glow) */}
          <rect x="27" y="50" width="7.5" height="7.5" rx="1" fill="#FBBF24" />
          <rect x="37.5" y="50" width="7.5" height="7.5" rx="1" fill="#FBBF24" />
          <rect x="27" y="60.5" width="7.5" height="7.5" rx="1" fill="#FBBF24" />
          <rect x="37.5" y="60.5" width="7.5" height="7.5" rx="1" fill="#FBBF24" />

          {/* Construction Hammer forming the Right Structural Slant */}
          {/* Hammer Handle (Slanted Steel/Silver) */}
          <path
            d="M48 68 L78 38 L83 43 L53 73 Z"
            fill="#CBD5E1"
            stroke="#94A3B8"
            strokeWidth="1"
          />
          {/* Hammer Head & Claw (Gold & Deep Slate) */}
          <path
            d="M72 32 L88 48 L93 43 L88 35 L92 31 L87 26 L81 30 L77 27 Z"
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="1.5"
          />

          {/* Solid Foundation Line */}
          <rect x="18" y="86" width="64" height="4" rx="2" fill="#F59E0B" />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline gap-1.5 tracking-tight">
          <span
            className={`font-black ${dimensions.text} uppercase tracking-wider ${
              isLight ? 'text-white' : 'text-slate-900'
            }`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            OMAL
          </span>
          <span
            className={`font-black ${dimensions.text} uppercase tracking-wider text-amber-500`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            HARDWARE
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`font-medium ${dimensions.sub} tracking-normal mt-1 ${
              isLight ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Building Your Tomorrow
          </span>
        )}
      </div>
    </div>
  );
};
