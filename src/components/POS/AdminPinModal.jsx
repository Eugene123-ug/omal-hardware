import React, { useState } from 'react';
import { ShieldCheck, KeyRound, X, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../services/api';

export default function AdminPinModal({ title, message, onApproved, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter Admin PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/auth/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: pin.trim() })
      });

      if (res.valid) {
        onApproved(res.approver, pin.trim());
        onClose();
      } else {
        setError(res.error || 'Invalid Admin PIN');
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (val) => {
    if (val === 'CLEAR') {
      setPin('');
      setError('');
    } else if (val === 'BACK') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 6) {
      setPin(prev => prev + val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold text-white">{title || 'Supervisor Authorization'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-300">
            {message || 'This action requires Super Admin or IT Manager PIN code authorization.'}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN (e.g. 1234 or 9999)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-amber-500 font-mono"
                />
                <KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
              </div>
              <div className="text-[11px] text-slate-500 text-center mt-1">
                Owner PIN: <code className="text-amber-400">9999</code> | IT Manager PIN: <code className="text-blue-400">1234</code>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick numeric touch keypad for POS touchscreens */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'CLEAR', 0, 'BACK'].map((btn) => (
                <button
                  type="button"
                  key={btn}
                  onClick={() => handleKeypadPress(btn)}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white rounded-xl text-sm font-semibold border border-slate-700 transition-colors">
                  {btn}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 text-xs font-bold transition-colors">
                {loading ? 'Verifying...' : 'Authorize Action'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
