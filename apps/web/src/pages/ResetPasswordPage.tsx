import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useCompany } from '../context/CompanyContext';

interface ResetPasswordPageProps {
  onNavigate?: (path: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  const { companyName, companyLogo } = useCompany();
  
  // URL token extraction
  const [token, setToken] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  // On page load, check token exists and is not expired
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get('token');

        if (!queryToken || !queryToken.trim()) {
          setTokenValid(false);
          setTokenError('Link expired');
          setIsVerifying(false);
          return;
        }

        const cleanToken = queryToken.trim();
        setToken(cleanToken);

        const res = await api.verifyResetToken(cleanToken);
        if (res && res.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(res?.message || 'Link expired');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err.message || 'Link expired');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newPassword || newPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.resetPassword({
        token,
        password: newPassword,
      });

      if (res && res.success) {
        setIsSuccess(true);
        // Automatically redirect to login with success confirmation after 1.8 seconds
        setTimeout(() => {
          navigateTo('/?updated=1');
        }, 1800);
      } else {
        setFormError(res?.message || 'Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Unable to update password. The link may have expired.');
    } finally {
      setIsSubmitting(false);
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
            <Lock className="w-8 h-8" />
          )}
        </div>

        {/* Typewriter text animation for company name */}
        <div className="text-center min-h-[20px] mb-2">
          <span className="text-[11px] font-extrabold tracking-widest text-blue-200 uppercase border-b border-blue-300/40 pb-0.5">
            {displayedText}
            <span className="animate-pulse ml-0.5 text-white">|</span>
          </span>
        </div>

        {/* State 1: Verifying Token on page load */}
        {isVerifying && (
          <div className="py-8 flex flex-col items-center gap-3 text-white text-xs">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <span className="font-semibold tracking-wider uppercase text-[11px]">
              Verifying Reset Token...
            </span>
          </div>
        )}

        {/* State 2: Invalid or Expired Token ("Link expired") */}
        {!isVerifying && !tokenValid && !isSuccess && (
          <div className="text-center py-2">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-200">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-bold tracking-wider uppercase text-white mb-2">
              {tokenError || 'Link expired'}
            </h1>

            <p className="text-xs text-white/80 mb-6 leading-relaxed">
              This password reset link is invalid or has expired. Password reset links are valid for 1 hour and can only be used once.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigateTo('/forgot-password')}
                className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center"
              >
                Request New Reset Link
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="w-full h-[48px] rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* State 3: Successful Password Update */}
        {!isVerifying && isSuccess && (
          <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/25 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-lg font-bold uppercase tracking-wider text-white mb-2">
              Password updated, login now
            </h1>

            <p className="text-xs text-emerald-100 mb-6">
              Your password has been changed successfully. Redirecting to login...
            </p>

            <button
              type="button"
              onClick={() => navigateTo('/?updated=1')}
              className="w-full h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* State 4: Valid Token -> Reset Password Form */}
        {!isVerifying && tokenValid && !isSuccess && (
          <div>
            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-1">
              Reset Password
            </h1>
            <p className="text-[11px] text-white/70 text-center mb-5 leading-relaxed">
              Create a new password for your account (min. 8 characters).
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* New Password Input (Height: 48px) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  disabled={isSubmitting}
                  className="w-full pl-11 pr-11 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[16px] text-white/60 hover:text-white transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm Password Input (Height: 48px) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  disabled={isSubmitting}
                  className="w-full pl-11 pr-11 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-[16px] text-white/60 hover:text-white transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Update Password Button (Height: 48px) */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    UPDATING PASSWORD...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>

              <div className="pt-2 flex flex-col items-center">
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
        )}
      </div>

      {/* Dynamic Company indicator below card */}
      <div className="mt-6 text-center text-xs text-white/60 font-semibold tracking-wider uppercase">
        {companyName || 'ENTERPRISE COMMERCIAL ERP'}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
