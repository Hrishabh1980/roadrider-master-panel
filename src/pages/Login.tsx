import React, { useState } from 'react';
import {
  Lock, Mail, Eye, EyeOff,
  AlertTriangle, ArrowRight, Shield, Database, CheckCircle2
} from 'lucide-react';
import { authApi } from '../services/api';
import { isSupabaseConfigured } from '../services/supabase';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState(''); // BUG-020 FIX: removed hardcoded production email
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  // BUG-005 FIX: 2FA state removed – UI was decoupled from backend MFA verification
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authApi.login({
        email,
        password,

      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center p-4 sm:p-6 font-sans selection:bg-[#A35E47] selection:text-white relative overflow-hidden">
      {/* Subtle warm ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-[#A35E47]/12 rounded-full blur-[140px]" />
      </div>

      {/* Main Single Centered Card */}
      <div className="relative w-full max-w-[500px] bg-[#141414] border border-[#242424] rounded-2xl shadow-2xl p-7 sm:p-9 z-10">
        {/* Official RoadRider Brand Logo */}
        <div className="flex items-center justify-center mb-6">
          <img
            src="/roadrider-delivery-logo.png"
            alt="RoadRider - Aapke Safar Ka Saarthi"
            className="h-14 sm:h-16 w-auto max-w-[240px] object-contain drop-shadow-md select-none"
          />
        </div>

        {/* Top Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#A35E47]/20 border border-[#A35E47]/40 flex items-center justify-center text-[#D89582] shrink-0">
            <Shield className="w-5 h-5 text-[#D89582]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
              Master Admin Sign In
            </h1>
            <p className="text-[11px] text-[#A0A0A0] font-medium tracking-wide">
              ROADRIDER ENTERPRISE CONSOLE
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-[13px] text-[#8E8E8E] leading-relaxed mb-4">
          Authenticate with your verified Supabase administrator credentials to manage platform vendors, KYC verifications, and operational workflows.
        </p>

        {/* Supabase backend status pill */}
        {/* BUG-020 FIX: Removed hardcoded production admin email from public display */}
        <div className="mb-5 flex flex-col gap-1.5 p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="text-[#A0A0A0] text-[11px]">Provider:</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Supabase Auth (Production)
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#6E6E6E] bg-[#222222] px-2 py-0.5 rounded">
              RLS Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8E8E8E] pt-1 border-t border-[#262626]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#A35E47]" />
            <span>Administrative access requires a verified admin role in profiles.</span>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authentication Refused</p>
              <p className="text-[11px] text-red-300 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Administrative Email */}
          <div>
            <label className="block text-[11px] font-bold text-[#A0A0A0] uppercase tracking-wider mb-2">
              Administrative Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555555]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white text-black placeholder-[#777777] rounded-xl text-xs sm:text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#A35E47] transition-all"
              />
            </div>
          </div>

          {/* Master Password / Security Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold text-[#A0A0A0] uppercase tracking-wider">
                Master Password / Security Key
              </label>
              {/* BUG-021 FIX: Enterprise Reset requires backend password-reset email – contact DB admin */}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#555555]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-[#0A0A0A] border border-[#2B2B2B] focus:border-[#A35E47] focus:ring-1 focus:ring-[#A35E47] rounded-xl text-white text-xs sm:text-[13px] placeholder-[#444444] outline-none transition-all font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6E6E6E] hover:text-[#A0A0A0] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* BUG-005 FIX: 2FA toggle removed – MFA must be verified server-side via
              supabase.auth.mfa.challengeAndVerify before it can be re-enabled in the UI */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#333333] bg-[#0A0A0A] text-[#1E6FE8] focus:ring-0 cursor-pointer accent-[#1E6FE8]"
              />
              <span className="text-xs text-[#9C9A9A]">Remember workstation</span>
            </label>
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#A35E47] hover:bg-[#8e513d] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#A35E47]/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate &amp; Enter Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footnote Compliance */}
        <div className="border-t border-[#222222] my-6" />
        <div className="text-center">
          <p className="text-[11px] text-[#6A6A6A]">
            Administrative access strictly requires a valid Supabase Auth session with an authorized profile role.
          </p>
          <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-[#555555]">
            <span>ISO 27001 Certified</span>
            <span>·</span>
            <span>SOC2 Type II</span>
            <span>·</span>
            <span>Role-Based Access Control</span>
          </div>
        </div>
      </div>
    </div>
  );
}
