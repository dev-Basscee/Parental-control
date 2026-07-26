import React, { useState, useEffect, useCallback } from 'react';
import { Device } from '../types';
import {
  Shield, X, RefreshCw, Check, Download, Key, HelpCircle,
  Laptop, Smartphone, Tablet, AlertCircle
} from 'lucide-react';
import { supabase, generatePairingCode } from '../lib/supabase';

interface PairingScreenProps {
  onClose: () => void;
  onDevicePaired: (newDevice: Device) => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ onClose, onDevicePaired }) => {
  const [digits, setDigits]           = useState<string[]>([]);
  const [expiresAt, setExpiresAt]     = useState<string | null>(null);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError]     = useState<string | null>(null);

  const [status, setStatus]           = useState<'waiting' | 'connecting' | 'success'>('waiting');
  const [newDeviceName, setNewDeviceName] = useState("Child's PC");
  const [newDeviceType, setNewDeviceType] = useState<'laptop' | 'phone' | 'tablet'>('laptop');

  // ── Countdown timer ────────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) fetchCode(); // auto-refresh when code expires
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // ── Fetch a real pairing code from the backend ─────────────────────────────
  const fetchCode = useCallback(async () => {
    if (!newDeviceName.trim()) return;
    setCodeLoading(true);
    setCodeError(null);
    try {
      const data = await generatePairingCode(newDeviceName.trim());
      setDigits(data.pairing_code.split(''));
      setExpiresAt(data.expires_at);
      setPendingDeviceId(data.device_id);
      setStatus('waiting');
    } catch (err: any) {
      setCodeError(err.message || 'Failed to generate code. Check your connection.');
    } finally {
      setCodeLoading(false);
    }
  }, [newDeviceName]);

  // Fetch on first mount
  useEffect(() => { fetchCode(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll for agent connection ──────────────────────────────────────────────
  // Once we have a pending device_id, poll every 3 s to see if the agent
  // completed pairing (device.status changed from 'pending' to 'connected').
  useEffect(() => {
    if (!pendingDeviceId || status !== 'waiting') return;

    const poll = async () => {
      try {
        const { data } = await supabase
          .from('devices')
          .select('id, status, device_name')
          .eq('id', pendingDeviceId)
          .single();

        if (data && data.status === 'connected') {
          setStatus('connecting');
          setTimeout(() => {
            setStatus('success');
            setTimeout(() => {
              const newDevice: Device = {
                id:                      data.id,
                name:                    data.device_name,
                type:                    newDeviceType,
                os:                      newDeviceType === 'laptop'
                                           ? 'Windows PC'
                                           : newDeviceType === 'phone'
                                             ? 'iOS / Android'
                                             : 'iPadOS',
                status:                  'online',
                screenTimeTodayMinutes:  0,
                maxDailyMinutes:         240,
                lastActive:              'Just linked now',
                ping:                    '—',
              };
              onDevicePaired(newDevice);
            }, 1500);
          }, 800);
        }
      } catch { /* network hiccup — retry next tick */ }
    };

    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [pendingDeviceId, status, newDeviceType, onDevicePaired]);

  // ── Minute-label helper ────────────────────────────────────────────────────
  const expiryLabel = () => {
    if (secondsLeft === null) return '';
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] font-sans overflow-x-hidden relative flex flex-col justify-between">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#b6c4ff] filter blur-[80px] opacity-15 pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b7c8e1] filter blur-[80px] opacity-15 pointer-events-none z-0" />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 bg-[radial-gradient(#00236f_1px,transparent_1px)] [background-size:32px_32px]" />

      {/* Header */}
      <header className="w-full sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/50">
        <div className="flex justify-between items-center px-8 py-4 w-full max-w-[1280px] mx-auto">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#00236f] fill-[#00236f]/10" />
            <span className="font-extrabold text-xl text-[#00236f] tracking-tight">GuardianDesk</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#dbe9ff] rounded-full transition-colors flex items-center gap-1.5 text-[#444651] font-semibold text-xs"
          >
            <X className="w-5 h-5" />
            <span className="hidden md:inline">Cancel Setup</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-6 py-12 flex flex-col items-center justify-center flex-1 z-10 w-full">
        <div className="w-full max-w-2xl grid grid-cols-1 gap-8 animate-in fade-in zoom-in-95 duration-300">

          {/* Step Progress */}
          <div className="flex justify-center items-center gap-4 mb-2">
            <div className="w-8 h-1 rounded-full bg-[#00236f]" />
            <div className="w-8 h-1 rounded-full bg-[#00236f]" />
            <div className="w-8 h-1 rounded-full bg-[#00236f]" />
            <div className="w-16 h-1 rounded-full bg-[#d4e4fa]" />
          </div>

          {/* Header Section */}
          <div className="text-center space-y-2">
            <h1 className="font-bold text-3xl md:text-4xl text-[#0d1c2d]">Link Child Device</h1>
            <p className="text-base text-[#444651] max-w-md mx-auto leading-relaxed">
              Enter this code in the GuardianDesk agent on your child's PC to establish a secure link.
            </p>
          </div>

          {/* Code Display Card */}
          <div className="glass-card rounded-2xl p-8 md:p-12 shadow-sm text-center relative overflow-hidden flex flex-col items-center border border-slate-200">

            {/* Device Label Input */}
            <div className="mb-6 w-full max-w-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Target Device Label
              </label>
              <div className="flex items-center gap-2">
                {(['laptop', 'phone', 'tablet'] as const).map((t) => {
                  const Icon = t === 'laptop' ? Laptop : t === 'phone' ? Smartphone : Tablet;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewDeviceType(t)}
                      className={`p-1.5 rounded-lg transition-colors ${newDeviceType === t ? 'bg-[#00236f] text-white' : 'bg-slate-200 text-slate-600'}`}
                      title={t}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  onBlur={() => digits.length === 0 && fetchCode()}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-[#00236f]"
                  placeholder="e.g. Leo's PC"
                />
              </div>
            </div>

            {/* Error banner */}
            {codeError && (
              <div className="mb-4 w-full max-w-xs flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{codeError}</span>
              </div>
            )}

            {/* Code Digits */}
            <div className="flex gap-2 md:gap-4 mb-2 justify-center min-h-[80px] items-center">
              {codeLoading ? (
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-12 h-16 md:w-16 md:h-20 bg-[#eef4ff] rounded-xl animate-pulse border border-[#c5c5d3]/30" />
                  ))}
                </div>
              ) : digits.length === 6 ? (
                digits.map((digit, idx) => (
                  <div
                    key={idx}
                    className="w-12 h-16 md:w-16 md:h-20 bg-[#e5efff] rounded-xl flex items-center justify-center text-[#00236f] font-bold text-3xl md:text-4xl border border-[#c5c5d3]/50 shadow-inner"
                  >
                    {digit}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Enter a device name above to generate a code</p>
              )}
            </div>

            {/* Countdown */}
            {expiresAt && secondsLeft !== null && secondsLeft > 0 && (
              <p className="text-[11px] text-slate-400 mb-6 font-semibold">
                Code expires in <span className="text-[#00236f] font-bold">{expiryLabel()}</span>
              </p>
            )}

            {/* Status Indicator */}
            <div className="transition-all duration-500 flex flex-col items-center">
              {status === 'waiting' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={fetchCode}
                      disabled={codeLoading}
                      className="w-12 h-12 bg-[#1e3a8a] rounded-full flex items-center justify-center z-10 relative hover:bg-[#00236f] transition-colors shadow-lg shadow-[#1e3a8a]/20 disabled:opacity-50"
                      title="Generate new pairing code"
                    >
                      <RefreshCw className={`w-6 h-6 text-white ${codeLoading ? 'animate-spin' : ''}`} style={{ animationDuration: '1s' }} />
                    </button>
                    <div className="absolute inset-0 bg-[#1e3a8a] rounded-full pulse-ring" />
                  </div>
                  <span className="text-xs font-bold text-[#444651] tracking-wider uppercase">
                    {codeLoading ? 'Generating code…' : 'Waiting for agent connection…'}
                  </span>
                  <p className="text-[11px] text-slate-400 text-center max-w-xs">
                    Run <code className="bg-slate-100 px-1 rounded text-slate-600">GuardianDeskSetup.exe</code> as Administrator on the child's PC and enter this code when prompted.
                  </p>
                </div>
              )}

              {status === 'connecting' && (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mb-4 shadow-lg animate-bounce">
                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <span className="text-xs font-bold text-amber-600 tracking-wider uppercase">
                    Verifying & Syncing…
                  </span>
                </div>
              )}

              {status === 'success' && (
                <div className="flex flex-col items-center animate-in zoom-in-75 duration-300">
                  <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 scale-110 transition-transform">
                    <Check className="w-8 h-8 text-white stroke-[3]" />
                  </div>
                  <span className="text-sm font-extrabold text-emerald-600 tracking-wider uppercase mb-1">
                    Connected! ✅
                  </span>
                  <p className="text-xs text-slate-500">Adding {newDeviceName} to your dashboard…</p>
                </div>
              )}
            </div>
          </div>

          {/* Instruction Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5 flex items-start gap-4 border border-slate-200 shadow-sm hover:border-[#00236f]/30 transition-colors">
              <div className="bg-[#d0e1fb] p-3 rounded-xl text-[#00236f] flex-shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0d1c2d] mb-1">1. Download Agent</h3>
                <p className="text-xs text-[#444651] leading-relaxed">
                  Download <span className="font-semibold text-[#00236f]">GuardianDeskSetup.exe</span> from the GitHub Releases page and run it as Administrator on the child's PC.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 flex items-start gap-4 border border-slate-200 shadow-sm hover:border-[#00236f]/30 transition-colors">
              <div className="bg-[#d0e1fb] p-3 rounded-xl text-[#00236f] flex-shrink-0">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0d1c2d] mb-1">2. Enter Code</h3>
                <p className="text-xs text-[#444651] leading-relaxed">
                  When prompted, type the 6-digit code shown above. The agent will pair automatically and this page will update.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Help */}
          <div className="text-center pt-2">
            <button
              onClick={() => alert(
                'Troubleshooting:\n' +
                '1. Make sure the child\'s PC has internet access.\n' +
                '2. Run GuardianDeskSetup.exe as Administrator.\n' +
                '3. The code expires after 15 minutes — click refresh to get a new one.\n' +
                '4. Check C:\\ProgramData\\GuardianDesk\\agent.log for errors.'
              )}
              className="text-[#00236f] text-xs font-semibold hover:underline decoration-2 underline-offset-4 flex items-center justify-center gap-1.5 mx-auto"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Having trouble pairing?</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
