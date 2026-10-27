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
  Building2,
} from 'lucide-react';
import { api, setAuthToken } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

interface LoginScreenProps {
  onLoginSuccess: (user: any, branches: any[], primaryBranch: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { settings } = useCompany();
  const [authMode, setAuthMode] = useState<'login' | 'forgot_password' | 'reset_password'>('login');

  // Credentials
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Rate Limiting
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    return Number(localStorage.getItem('wonark_login_failed_attempts') || 0);
  });
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    return Number(localStorage.getItem('wonark_login_lockout_until') || 0);
  });

  // Typewriter Animation state
  const targetText = settings.companyName || 'WONARK COMPANY LIMITED';
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);

  // Typewriter effect loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = targetText;
    const currentLength = displayedText.length;

    if (!isDeleting && currentLength < fullText.length) {
      timer = setTimeout(() => {
        setDisplayedText(fullText.slice(0, currentLength + 1));
      }, 90);
    } else if (!isDeleting && currentLength === fullText.length) {
      // Pause at full text
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 2500);
    } else if (isDeleting && currentLength > 0) {
      timer = setTimeout(() => {
        setDisplayedText(fullText.slice(0, currentLength - 1));
      }, 45);
    } else if (isDeleting && currentLength === 0) {
      setIsDeleting(false);
      setLoopIndex((prev) => prev + 1);
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, targetText, loopIndex]);

  // Check URL parameters for password reset link (?token=...&email=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      setResetToken(token);
      setResetEmail(email);
      setAuthMode('reset_password');
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Check rate limit lock
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingMins = Math.ceil((lockoutUntil - now) / 60000);
      setErrorMessage(`Account access temporarily locked due to too many failed attempts. Try again in ${remainingMins} minute(s).`);
      return;
    }

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
      if (res.success && res.data.token) {
        // Reset rate limiting counters on successful login
        localStorage.removeItem('wonark_login_failed_attempts');
        localStorage.removeItem('wonark_login_lockout_until');
        setFailedAttempts(0);
        setLockoutUntil(0);

        setAuthToken(res.data.token);
        onLoginSuccess(res.data.user, res.data.branches || [], res.data.primaryBranch);
      } else {
        registerFailedAttempt();
        setErrorMessage(res.message || 'Invalid username or password.');
      }
    } catch (err: any) {
      registerFailedAttempt();
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const registerFailedAttempt = () => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    localStorage.setItem('wonark_login_failed_attempts', String(newCount));

    if (newCount >= 5) {
      const lockTime = Date.now() + 15 * 60 * 1000; // 15 mins lock
      setLockoutUntil(lockTime);
      localStorage.setItem('wonark_login_lockout_until', String(lockTime));
      setErrorMessage('Security lock active: 5 failed attempts reached. System locked for 15 minutes.');
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
        if (res.data?.token) {
          setResetToken(res.data.token);
          setResetEmail(trimmedEmail);
          setSuccessMessage('Verification token generated. Please enter your new password below:');
          setAuthMode('reset_password');
        } else {
          setSuccessMessage('If an account exists with this email, password reset instructions have been sent.');
        }
      } else {
        setErrorMessage(res.message || 'Failed to dispatch password reset request.');
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
        token: resetToken,
        email: resetEmail,
        password: newPassword,
      });

      if (res.success) {
        setSuccessMessage('Password reset successfully! You can now log in with your new password.');
        setAuthMode('login');
        setPassword('');
        window.history.replaceState({}, document.title, window.location.pathname);
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
    <div className="min-h-screen bg-gradient-to-br from-[#09152e] via-[#0f2147] to-[#122856] flex flex-col items-center justify-center p-4 relative select-none">
      {/* Background glow effects */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* Top Center Typewriter Animation */}
      <div className="mb-6 text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-2 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">Enterprise Secure Portal</span>
        </div>

        <div className="h-10 flex items-center justify-center">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider font-mono">
            {displayedText}
            <span className="inline-block w-2 h-5 bg-amber-400 ml-1 animate-pulse" />
          </h1>
        </div>
      </div>

      {/* Main Centered Login Card */}
      <div className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 p-8 shadow-2xl relative text-white z-10">
        {/* Dynamic Logo from Business Settings */}
        <div className="flex flex-col items-center justify-center mb-6">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={targetText}
              className="w-16 h-16 object-contain rounded-2xl p-1 bg-white/10 border border-white/20 shadow-md mb-2"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-xl flex items-center justify-center shadow-lg border border-amber-400/40 mb-2">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <span className="text-xs font-semibold text-white/70 tracking-wide text-center uppercase">
            Management &amp; Sales System
          </span>
        </div>

        {/* Notifications */}
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

        {/* Mode 1: LOGIN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            {/* Identity Input */}
            <div className="relative">
              <User className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
              <input
                type="text"
                autoComplete="username"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="Username or Email"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white/20 transition"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white/20 transition"
                required
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:opacity-90 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <span className="animate-pulse">AUTHENTICATING...</span>
              ) : (
                <span>SIGN IN</span>
              )}
            </button>

            {/* Bottom Links */}
            <div className="flex items-center justify-between text-xs text-white/70 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600 bg-white/20 border-white/30"
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setAuthMode('forgot_password');
                }}
                className="hover:text-amber-400 hover:underline transition cursor-pointer font-medium"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {/* Mode 2: FORGOT PASSWORD */}
        {authMode === 'forgot_password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <p className="text-xs text-white/80 leading-relaxed mb-4">
              Enter your registered staff email address to receive password reset instructions.
            </p>

            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="staff@wonark.com"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? 'SENDING RESET LINK...' : 'SEND RESET INSTRUCTIONS'}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setAuthMode('login');
              }}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}

        {/* Mode 3: RESET PASSWORD FORM */}
        {authMode === 'reset_password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <p className="text-xs text-white/80 leading-relaxed mb-2">
              Create a new secure password for <strong>{resetEmail}</strong>:
            </p>

            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 8 characters)"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                required
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? 'UPDATING PASSWORD...' : 'SET NEW PASSWORD'}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setAuthMode('login');
              }}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-white/40 text-[11px] z-10">
        <p>&copy; {new Date().getFullYear()} {targetText}. All Rights Reserved.</p>
        <p className="mt-0.5">Commercial Inventory &amp; Point of Sale Management System</p>
      </div>
    </div>
  );
};
