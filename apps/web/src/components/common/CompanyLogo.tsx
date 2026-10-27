import React from 'react';
import { Building2 } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';

export interface CompanyLogoProps {
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  showText?: boolean;
  textColor?: string;
  subtextColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = 'flex items-center gap-2.5',
  imgClassName,
  fallbackClassName,
  showText = true,
  textColor,
  subtextColor,
  size = 'md',
  variant = 'light',
  showSubtitle = true,
}) => {
  const { settings } = useCompany();
  const name = settings.companyName || 'WONARK COMPANY LIMITED';

  // Get initials (up to 2 letters, e.g. "WC" from Wonark Company)
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word?.[0]?.toUpperCase() || '')
      .join('') || 'WC';

  const sizeClass = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size];

  const resolvedImgClass = imgClassName || `${sizeClass} object-contain rounded-xl bg-white/10 p-1`;
  const resolvedFallbackClass =
    fallbackClassName ||
    `${sizeClass} rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white font-black shadow-md border border-emerald-500/30`;

  const resolvedTextColor = textColor || (variant === 'light' ? 'text-white' : 'text-slate-900');
  const resolvedSubtextColor =
    subtextColor || (variant === 'light' ? 'text-emerald-400' : 'text-emerald-600');

  return (
    <div className={className}>
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={name}
          className={resolvedImgClass}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className={resolvedFallbackClass} title={name}>
          {initials ? <span>{initials}</span> : <Building2 className="w-4 h-4 text-white" />}
        </div>
      )}

      {showText && (
        <div className="leading-tight select-none">
          <div className={`font-black text-sm tracking-tight ${resolvedTextColor}`}>
            {name}
          </div>
          {showSubtitle && (
            <div className={`text-[10px] font-semibold tracking-wider uppercase ${resolvedSubtextColor}`}>
              Commercial ERP
            </div>
          )}
        </div>
      )}
    </div>
  );
};
