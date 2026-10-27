import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading data...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10'
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
      <RefreshCw className={`${sizeClasses[size] || sizeClasses.md} animate-spin text-amber-500`} />
      {message && <p className="text-xs font-medium text-slate-400">{message}</p>}
    </div>
  );
}
