import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { api, setAuthToken } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

interface LoginScreenProps {
  onLoginSuccess: (user: any, branches: any[], primaryBranch: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { settings, companyName, companyLogo } = useCompany();
  const [authMode, setAuthMode] = useState<'login' | 'reset_password'>('login');

  // Credentials
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [masterPin, setMasterPin] = useState('2026');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  // Typewriter text animation for business_settings.company_name
  const targetText = companyName || settings.companyName || 'WONARK COMPANY LIMITED';
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(120);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fullText = targetText;

    const handleType = () => {
      setDisplayedText((prev) => {
        if (!isDeleting) {
          const nextText = fullText.slice(0, prev.length + 1);
          if (nextText === fullText) {
            setTypingSpeed(2200); // Pause at complete company name
            setIsDeleting(true);
          } else {
            setTypingSpeed(80);
          }
          return nextText;
        } else {
          const nextText = fullText.slice(0, prev.length - 1);
          if (nextText === '') {
            setIsDeleting(false);
            setLoopNum((l) => l + 1);
            setTypingSpeed(500); // Pause before re-typing
          } else {
            setTypingSpeed(40);
          }
          return nextText;
        }
      });
    };

    timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, typingSpeed, targetText, loopNum]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Check lockout timer
    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const remainingMins = Math.ceil((lockoutUntil - now) / 60000);
      setErrorMessage(
        `Account access temporarily locked due to failed attempts. Try again in ${remainingMins} minute(s).`
      );
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
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
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

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailTrimmed = resetEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setErrorMessage('Please enter your registered username or email.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.resetPassword({
        email: emailTrimmed,
        password: newPassword,
        recoveryPin: masterPin.trim() || '2026',
      });

      if (res.success) {
        setSuccessMessage('Password updated successfully! You can now sign in with your new credentials.');
        setIdentity(emailTrimmed);
        setPassword(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        setAuthMode('login');
      } else {
        setErrorMessage(res.message || 'Unable to update password. Check email or recovery PIN.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#041a12] via-[#082a1d] to-[#03150e] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative select-none">
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* Top Typewriter Banner */}
      <div className="mb-6 text-center z-10 w-full max-w-lg">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-2 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            Enterprise Commercial Portal
          </span>
        </div>

        <div className="h-10 flex items-center justify-center px-4">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider font-mono truncate">
            {displayedText}
            <span className="inline-block w-2 h-5 bg-amber-400 ml-1 animate-pulse align-middle" />
          </h1>
        </div>
      </div>

      {/* Main Single-Column Medium Card (Responsive across all screens) */}
      <div className="w-full max-w-lg rounded-3xl bg-slate-900/70 backdrop-blur-2xl border border-white/15 p-6 sm:p-10 shadow-2xl relative text-white z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Company Logo Header */}
        <div className="flex flex-col items-center justify-center mb-6">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={targetText}
              className="w-16 h-16 object-contain rounded-2xl p-1 bg-white/10 border border-white/20 shadow-md mb-2"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-black text-xl flex items-center justify-center shadow-lg border border-emerald-400/40 mb-2">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <span className="text-xs font-semibold text-white/70 tracking-wide text-center uppercase">
            Inventory &bull; Point of Sale &bull; Financial ERP
          </span>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. SIGN IN FORM */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-3.5 text-white/50" />
                <input
                  type="text"
                  autoComplete="username"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Enter username or email address"
                  disabled={isLoading}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-3.5 text-white/50" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter security password"
                  disabled={isLoading}
                  className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-white/50 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs text-white/70 pt-1">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white/20 border-white/30 text-emerald-600 focus:ring-0"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setResetEmail(identity.trim());
                  setAuthMode('reset_password');
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer transition"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:opacity-90 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-700/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <span className="animate-pulse">AUTHENTICATING...</span>
              ) : (
                <span>SIGN IN TO WORKSPACE</span>
              )}
            </button>
          </form>
        ) : (
          /* 2. INSTANT SELF-SERVICE PASSWORD RESET FORM */
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4" noValidate>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 pb-1">
              <KeyRound className="w-4 h-4" />
              <span>Instant Self-Service Password Reset</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">
                Your Username or Email *
              </label>
              <input
                type="text"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="e.g. admin or staff@company.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-white/80">
                  Master Security PIN
                </label>
                <span className="text-[10px] text-amber-400 font-semibold font-mono">
                  Default PIN: 2026
                </span>
              </div>
              <input
                type="text"
                value={masterPin}
                onChange={(e) => setMasterPin(e.target.value)}
                placeholder="2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2.5 text-white/50 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Confirm Password *
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setAuthMode('login');
                }}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isLoading ? 'Updating Password...' : 'Save & Update Password'}
              </button>
            </div>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-white/50">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Encrypted Session &bull; Single-Company High Availability</span>
        </div>
      </div>
    </div>
  );
};
