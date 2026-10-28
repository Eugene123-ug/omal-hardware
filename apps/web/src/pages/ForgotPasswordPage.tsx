import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { useCompany } from '../context/CompanyContext';

interface ForgotPasswordPageProps {
  onNavigate?: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate }) => {
  const { companyName, companyLogo } = useCompany();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Typewriter animation looping for company name
  const targetText = companyName || 'WONARK COMPANY LIMITED';
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(110);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = targetText;

    if (!isDeleting && displayedText === fullText) {
      timer = setTimeout(() => setIsDeleting(true), 2400);
    } else if (isDeleting && displayedText === '') {
      setIsDeleting(false);
      setTypingSpeed(110);
    } else {
      timer = setTimeout(() => {
        const nextText = isDeleting
          ? fullText.substring(0, displayedText.length - 1)
          : fullText.substring(0, displayedText.length + 1);
        setDisplayedText(nextText);
        setTypingSpeed(isDeleting ? 40 : 80);
      }, typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, typingSpeed, targetText]);

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.forgotPassword(trimmedEmail);
      if (res && res.success) {
        setSuccessMessage(
          res.message ||
            'If that email address is registered, password reset instructions have been sent to your inbox.'
        );
      } else {
        setErrorMessage(res?.message || 'Unable to process reset request. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to send reset instructions. Please check your network and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#1e40af] via-[#3b82f6] to-[#0ea5e9]">
      <div className="relative w-[90%] sm:w-[400px] p-8 rounded-3xl bg-white/15 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
        {/* Top-right company indicator */}
        <div className="absolute top-5 right-5 text-[10px] tracking-widest text-white/50 font-bold uppercase truncate max-w-[120px]">
          {companyName ? companyName.split(' ')[0] : 'ENTERPRISE'}
        </div>

        {/* Center Logo / Avatar Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-2.5 shadow-inner overflow-hidden">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="w-12 h-12 object-contain rounded-xl p-1"
            />
          ) : (
            <Mail className="w-8 h-8" />
          )}
        </div>

        {/* Typewriter text animation for company name */}
        <div className="text-center min-h-[20px] mb-2">
          <span className="text-[11px] font-extrabold tracking-widest text-blue-200 uppercase border-b border-blue-300/40 pb-0.5">
            {displayedText}
            <span className="animate-pulse ml-0.5 text-white">|</span>
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-2">
          Forgot Password
        </h1>

        <p className="text-[12px] text-white/80 text-center mb-6 leading-relaxed">
          Enter your registered email address to receive a secure password reset link.
        </p>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/25 border border-emerald-400/50 text-emerald-100 text-xs flex flex-col gap-1.5 shadow-md">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
              <span>Reset Email Dispatched</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 leading-relaxed">
              {successMessage}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email Input (Height: 48px) */}
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered Email Address"
              disabled={isLoading}
              className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
              required
            />
          </div>

          {/* Send Reset Link Button (Height: 48px) */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                SENDING RESET LINK...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>

          {/* Link back to login */}
          <div className="pt-2 flex flex-col items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="flex items-center gap-1.5 text-blue-100 hover:text-white transition cursor-pointer text-xs font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
              <span>Back to Login</span>
            </button>
          </div>
        </form>
      </div>

      {/* Dynamic Company footer */}
      <div className="mt-6 text-center text-xs text-white/60 font-semibold tracking-wider uppercase">
        {companyName || 'ENTERPRISE COMMERCIAL ERP'}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
