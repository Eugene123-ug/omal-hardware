import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorMessage({ 
  message = 'An unexpected error occurred', 
  details = null,
  onRetry = null 
}) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-200 flex items-start justify-between gap-3 shadow-lg">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white">{message}</div>
          {details && <div className="text-[11px] text-red-300 font-mono">{details}</div>}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg font-semibold transition-colors shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
