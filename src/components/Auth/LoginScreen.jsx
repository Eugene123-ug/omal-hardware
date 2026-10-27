import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function LoginScreen() {
  const { login, switchDemoRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Super Admin (Remote Owner)', email: 'owner@omal.com', pass: 'owner123', pin: '9999', desc: 'Remote outside Ghana. Sees total profit, costs & live feed' },
    { role: 'Admin / IT Manager (Ghana)', email: 'admin@omal.com', pass: 'admin123', pin: '1234', desc: 'Showroom & Depot manager. Manages stock inward & prices' },
    { role: 'Sales Cashier (Kwame)', email: 'kwame@omal.com', pass: 'kwame123', pin: 'None', desc: 'Fast POS, no cost price visibility, daily closing required' },
    { role: 'Accountant (Yaw)', email: 'accountant@omal.com', pass: 'acc123', pin: 'None', desc: 'Financial reports, expenses, cash closures & statements' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 text-slate-950 font-black">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            OMAL BUSINESS ERP
          </h1>
          <p className="text-xs text-slate-400">
            Tiles, Security Doors, Sanitary, Paints & Hardware Management System
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="text-slate-400 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. owner@omal.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all">
              <span>{loading ? 'Authenticating...' : 'Sign In to Store System'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins for Pair Programming and Evaluation */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold text-center">
              One-Click Role Demonstration Accounts
            </span>

            <div className="space-y-1.5">
              {demoAccounts.map(acc => (
                <button
                  type="button"
                  key={acc.email}
                  onClick={() => switchDemoRole(acc.email, acc.pass)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors flex items-center justify-between group">
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-amber-400 transition-colors">
                      {acc.role}
                    </div>
                    <div className="text-[10px] text-slate-400">{acc.desc}</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300">
                    PIN: {acc.pin}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          Encrypted Authentication • Offline-First Synced POS • Accra, Ghana
        </div>
      </div>
    </div>
  );
}
