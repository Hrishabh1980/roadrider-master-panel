import React, { useState, useEffect, useRef } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, ShieldCheck, Wifi } from 'lucide-react';
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  testSupabaseConnection,
  SupabaseHealthCheck
} from '../services/supabase';

export default function SupabaseBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<SupabaseHealthCheck | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await testSupabaseConnection();
      setHealth(res);
    } catch {
      setHealth({
        isConfigured: isSupabaseConfigured,
        isConnected: false,
        error: 'Failed to test connection',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isConnected = health?.isConnected;
  const isConfigured = isSupabaseConfigured;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
          isConnected
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            : isConfigured
            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
        }`}
        title="Supabase Database Connection Status"
      >
        <div className="relative flex items-center justify-center">
          <Database className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-600' : isConfigured ? 'text-amber-600' : 'text-stone-400'}`} />
          {isConnected && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <span className="hidden sm:inline">Supabase</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
          isConnected
            ? 'bg-emerald-200/70 text-emerald-900'
            : isConfigured
            ? 'bg-amber-200/70 text-amber-900'
            : 'bg-stone-200 text-stone-700'
        }`}>
          {loading ? 'Testing...' : isConnected ? 'Connected' : isConfigured ? 'Connecting' : 'Not Connected'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E8E8E8] rounded-2xl shadow-2xl p-4 z-50 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0]">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-black">Supabase Status</h4>
                <p className="text-[10px] text-[#9C9A9A]">PostgreSQL Database & Auth</p>
              </div>
            </div>
            <button
              onClick={runCheck}
              disabled={loading}
              className="p-1 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-black transition-colors"
              title="Re-test connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Body */}
          <div className="py-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-stone-100">
              <span className="text-stone-500">Connection State:</span>
              <span className="flex items-center gap-1 font-bold">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Online & Active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700">{isConfigured ? 'Verifying / Idle' : 'Keys Not Set in .env'}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-stone-100">
              <span className="text-stone-500">Project Endpoint:</span>
              <span className="font-mono text-[11px] text-stone-800 truncate max-w-[170px]" title={SUPABASE_URL || 'Not configured'}>
                {SUPABASE_URL ? SUPABASE_URL.replace('https://', '') : 'None'}
              </span>
            </div>

            {health?.latencyMs !== undefined && (
              <div className="flex items-center justify-between py-1 border-b border-stone-100">
                <span className="text-stone-500">API Ping Latency:</span>
                <span className="font-mono font-bold text-stone-800 flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  {health.latencyMs} ms
                </span>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-stone-500">Last Verified:</span>
              <span className="text-[11px] text-stone-600 font-medium">
                {health?.timestamp || 'Just now'}
              </span>
            </div>

            {health?.error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 leading-snug">
                <span className="font-bold">Notice:</span> {health.error}
              </div>
            )}

            {!isConfigured && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">Make sure you saved your .env file:</p>
                <code className="block bg-amber-100/70 p-1 rounded font-mono text-[10px] break-all select-all">
                  VITE_SUPABASE_URL=https://xyz.supabase.co
                  <br />
                  VITE_SUPABASE_ANON_KEY=eyJ...
                </code>
                <p className="mt-1 text-[10px] text-amber-700">Remember to press <kbd className="px-1 py-0.5 bg-white rounded border border-amber-300 font-sans">Cmd+S</kbd> to save changes to .env.</p>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2 border-t border-[#F0F0F0]">
            <button
              onClick={runCheck}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-black text-white hover:bg-stone-800 text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Testing Supabase...' : 'Test Connection Again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
