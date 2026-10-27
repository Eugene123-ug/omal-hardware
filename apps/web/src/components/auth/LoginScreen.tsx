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
} from 'lucide-react';
import { api, setAuthToken } from '../../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: any, branches: any[], primaryBranch: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
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

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        if (res.data?.token) {
          setResetToken(res.data.token);
          setResetEmail(trimmedEmail);
          setSuccessMessage('Reset instructions sent to your email. Enter your new password below:');
          setAuthMode('reset_password');
        } else {
          setSuccessMessage('A password reset link has been dispatched to your email address.');
        }
      } else {
        setErrorMessage(res.message || 'Failed to dispatch password reset email.');
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
    <div className="min-h-screen bg-gradient-to-br from-[#1963c6] via-[#1554a9] to-[#0f3e7e] flex flex-col items-center justify-center p-4 relative select-none">
      {/* Subtle background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />

      {/* Main Glass Card matching user image */}
      <div className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 shadow-2xl relative text-white">
        {/* Top-left window dots (•••) */}
        <div className="absolute top-5 left-5 flex items-center gap-1.5 opacity-60">
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/70" />
        </div>

        {/* Top-right company indicator */}
        <div className="absolute top-5 right-5 text-[10px] tracking-widest text-white/50 font-bold">
          OMAL
        </div>

        {/* Mode 1: LOGIN FORM */}
        {authMode === 'login' && (
          <div>
            {/* Center Avatar Badge */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white mb-3 shadow-inner">
              <User className="w-9 h-9" />
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-6">
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
              {/* Username or Email Input with User icon */}
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
                <input
                  type="text"
                  autoComplete="username"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Username or Email"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              {/* Password Input with Lock icon (Strictly Hidden, No Eye Icon) */}
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              {/* Big Bold LOGIN Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="animate-pulse">SIGNING IN...</span>
                ) : (
                  <span>LOGIN</span>
                )}
              </button>

              {/* Bottom: Remember Me & Forgot Password? */}
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
                  className="hover:text-white hover:underline transition cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mode 2: FORGOT PASSWORD FORM */}
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
              <Mail className="w-9 h-9" />
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-1">
              RESET PASSWORD
            </h1>
            <p className="text-[11px] text-white/70 text-center mb-5">
              Enter your registered email to receive your password reset verification.
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
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
                <input
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60"
              >
                {isLoading ? 'DISPATCHING...' : 'SEND RESET INSTRUCTIONS'}
              </button>
            </form>
          </div>
        )}

        {/* Mode 3: SET NEW PASSWORD FORM */}
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
              <KeyRound className="w-9 h-9" />
            </div>

            <h1 className="text-xl font-bold tracking-widest text-center uppercase text-white/95 mb-1">
              NEW PASSWORD
            </h1>
            <p className="text-[11px] text-white/70 text-center mb-5">
              Enter and confirm your new secure account password.
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
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/60" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
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
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/20 border border-white/25 text-white placeholder-white/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/25 transition"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-60"
              >
                {isLoading ? 'UPDATING...' : 'UPDATE PASSWORD & SIGN IN'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Subtle footer */}
      <div className="mt-6 text-center text-xs text-white/40 font-mono">
        OMAL HARDWARE LTD • ACCRA &amp; TEMA DEPOT
      </div>
    </div>
  );
};
