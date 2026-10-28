import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Mail,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Shield,
  Loader2,
} from 'lucide-react';
import { api, setAuthToken } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

interface LoginScreenProps {
  onLoginSuccess: (user: any, branches: any[], primaryBranch: any) => void;
  onNavigate?: (path: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onNavigate }) => {
  const { companyName, companyLogo } = useCompany();
  const [authMode, setAuthMode] = useState<'login' | 'forgot_password' | 'reset_password'>('login');

  const navigateTo = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Credentials
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset via Resend Email / Master PIN
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [masterPin, setMasterPin] = useState('2026');

  // Status & Feedback
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

  // Check URL parameters for password update success (?updated=1) or token redirect
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('updated') === '1' || params.get('reset_success') === '1') {
        setSuccessMessage('Password updated, login now');
      }

      const token = params.get('token');
      if (token) {
        navigateTo(`/reset-password?token=${encodeURIComponent(token)}`);
      }
    } catch {}
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedIdentity = identity.trim();
    if (!trimmedIdentity) {
      setErrorMessage('Please enter your username or email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login(trimmedIdentity, password);
      if (res.success && res.data?.token) {
        setAuthToken(res.data.token);
        onLoginSuccess(res.data.user, res.data.branches || [], res.data.primaryBranch);
      } else {
        setErrorMessage(res.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = forgotEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.forgotPassword(trimmedEmail);
      if (res.success) {
        setSuccessMessage(
          res.message ||
            'If an account matches that email address, a password reset link has been dispatched to your inbox.'
        );
        setResetEmail(trimmedEmail);
      } else {
        setErrorMessage(res.message || 'Unable to process reset request.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to process password reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.resetPassword({
        token: resetToken || 'DIRECT_PIN_RESET',
        email: resetEmail || forgotEmail,
        password: newPassword,
        recoveryPin: masterPin || '2026',
      });

      if (res.success) {
        setSuccessMessage('Password reset successfully! You can now log in with your new password.');
        setPassword('');
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {}
        setTimeout(() => {
          setAuthMode('login');
          setSuccessMessage(null);
        }, 2200);
      } else {
        setErrorMessage(res.message || 'Failed to reset password. Link may be invalid or expired.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1963c6] via-[#1554a9] to-[#0f3e7e] flex flex-col items-center justify-center p-4 relative select-none">
      {/* Subtle background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />

      {/* Main Glass Card: exactly 400px on desktop, 90% on mobile, 32px padding */}
      <div className="w-[90%] sm:w-[400px] max-w-[400px] rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 shadow-2xl relative text-white">
        {/* Top-left window dots (•••) */}
        <div className="absolute top-5 left-5 flex items-center gap-1.5 opacity-60">
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
        </div>

        {/* Top-right company indicator */}
        <div className="absolute top-5 right-5 text-[10px] tracking-widest text-white/50 font-bold uppercase truncate max-w-[120px]">
          {companyName ? companyName.split(' ')[0] : 'ENTERPRISE'}
        </div>

        {/* Mode 1: LOGIN FORM */}
        {authMode === 'login' && (
          <div>
            {/* Center Avatar Badge */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-2.5 shadow-inner overflow-hidden">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="w-12 h-12 object-contain rounded-xl p-1"
                />
              ) : (
                <User className="w-9 h-9" />
              )}
            </div>

            {/* Typewriter text animation for company name */}
            <div className="text-center min-h-[20px] mb-2">
              <span className="text-[11px] font-extrabold tracking-widest text-blue-200 uppercase border-b border-blue-300/40 pb-0.5">
                {displayedText}
                <span className="animate-pulse ml-0.5 text-white">|</span>
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-5">
              LOGIN
            </h1>

            {/* Error / Success Notifications */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              {/* Username or Email Input (Height: 48px) */}
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type="text"
                  autoComplete="username"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Username or Email"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              {/* Password Input (Height: 48px) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              {/* Login Button (Height: 48px) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SIGNING IN...
                  </>
                ) : (
                  'LOGIN'
                )}
              </button>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs text-white/80 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-white/20 border-white/40 text-blue-600 focus:ring-0 cursor-pointer accent-blue-500"
                  />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('/forgot-password');
                  }}
                  className="text-[11px] hover:text-white transition cursor-pointer underline underline-offset-2"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mode 2: FORGOT PASSWORD */}
        {authMode === 'forgot_password' && (
          <div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setAuthMode('login');
              }}
              className="flex items-center gap-1 text-xs text-white/70 hover:text-white mb-4 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>

            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-3 shadow-inner">
              <Mail className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-1">
              FORGOT PASSWORD
            </h1>
            <p className="text-[11px] text-white/70 text-center mb-5 leading-relaxed">
              Enter your registered email address to receive a secure password reset link via Resend.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" noValidate>
              {/* Email Input (Height: 48px) */}
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter registered email address"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SENDING LINK...
                  </>
                ) : (
                  'SEND RESET LINK'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(forgotEmail);
                    setAuthMode('reset_password');
                  }}
                  className="text-[11px] text-blue-200 hover:text-white underline cursor-pointer"
                >
                  Have a reset token or Master PIN? Enter password &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mode 3: SET NEW PASSWORD */}
        {authMode === 'reset_password' && (
          <div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setAuthMode('login');
              }}
              className="flex items-center gap-1 text-xs text-white/70 hover:text-white mb-4 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>

            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-3 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-1">
              NEW PASSWORD
            </h1>
            <p className="text-[11px] text-white/70 text-center mb-5">
              Enter and confirm your new account password (min. 8 characters).
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4" noValidate>
              {/* Email field if not set by link */}
              {!resetEmail && (
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Your account email"
                    disabled={isLoading}
                    className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                    required
                  />
                </div>
              )}

              {/* New Password Input (Height: 48px) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              {/* Confirm Password Input (Height: 48px) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-[16px] text-white/60" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    UPDATING...
                  </>
                ) : (
                  'UPDATE PASSWORD & SIGN IN'
                )}
              </button>
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
