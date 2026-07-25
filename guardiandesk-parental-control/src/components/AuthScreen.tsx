import React, { useState } from 'react';
import { Shield, ShieldAlert, Clock, MapPin, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onLoginSuccess: (isEmptyStateDemo?: boolean) => void;
  onOpenPairing: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onOpenPairing }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'empty-state-demo'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        // After sign-up Supabase sends a confirmation email.
        // For now, proceed directly (email confirmation can be disabled in Supabase dashboard for dev).
        onLoginSuccess(true); // treat fresh account as empty-state
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoginSuccess(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authMode === 'empty-state-demo') {
    return (
      <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] flex flex-col justify-between">
        <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#00236f] fill-[#00236f]/10" />
            <span className="font-bold text-xl text-[#00236f]">GuardianDesk</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onLoginSuccess(false)}
              className="text-xs font-semibold text-[#1e3a8a] bg-[#eef4ff] px-3 py-1.5 rounded-lg hover:bg-[#d0e1fb] transition-colors"
            >
              Skip to Populated Dashboard →
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-12 max-w-[1280px] mx-auto w-full flex flex-col items-center justify-center">
          <div className="max-w-lg w-full text-center space-y-8 animate-in fade-in duration-500">
            <div className="relative w-48 h-48 mx-auto mb-8">
              <div className="absolute inset-0 bg-[#1e3a8a]/5 rounded-full animate-pulse" />
              <div className="absolute inset-4 bg-[#1e3a8a]/10 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center shadow-2xl">
                  <Plus className="w-12 h-12" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-bold text-3xl md:text-4xl text-[#0d1c2d]">Let's secure your first device</h1>
              <p className="text-base text-[#444651] leading-relaxed">
                You haven't added any child devices yet. GuardianDesk works best when you can monitor and manage your family's phones, tablets, and computers from one place.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button 
                onClick={onOpenPairing}
                className="bg-[#1e3a8a] text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#00236f] transition-all shadow-lg shadow-[#1e3a8a]/20 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Add a Child Device</span>
              </button>
              <button 
                onClick={() => onLoginSuccess(false)}
                className="bg-[#dbe9ff] text-[#0d1c2d] px-8 py-3.5 rounded-xl font-semibold hover:bg-[#d4e4fa] transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Explore Live Demo Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-5 glass-panel rounded-xl text-left border border-slate-200 hover:-translate-y-1 transition-transform shadow-sm">
                <ShieldAlert className="w-6 h-6 text-[#00236f] mb-3" />
                <h3 className="font-bold text-sm mb-1.5 text-[#0d1c2d]">Safe Search</h3>
                <p className="text-xs text-[#444651] leading-relaxed">Automatically filter explicit content on Google, Bing, and YouTube.</p>
              </div>
              <div className="p-5 glass-panel rounded-xl text-left border border-slate-200 hover:-translate-y-1 transition-transform shadow-sm">
                <Clock className="w-6 h-6 text-[#00236f] mb-3" />
                <h3 className="font-bold text-sm mb-1.5 text-[#0d1c2d]">Time Limits</h3>
                <p className="text-xs text-[#444651] leading-relaxed">Set daily limits and 'No Screen' schedules for homework.</p>
              </div>
              <div className="p-5 glass-panel rounded-xl text-left border border-slate-200 hover:-translate-y-1 transition-transform shadow-sm">
                <MapPin className="w-6 h-6 text-[#00236f] mb-3" />
                <h3 className="font-bold text-sm mb-1.5 text-[#0d1c2d]">Live Tracking</h3>
                <p className="text-xs text-[#444651] leading-relaxed">Know where your family is with real-time GPS location updates.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-[1000px] w-full grid md:grid-cols-2 bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200/60">
        {/* Left Side: Brand Visual */}
        <div className="relative hidden md:flex flex-col justify-between p-10 bg-[#00236f] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#b6c4ff_1px,transparent_1px)] [background-size:24px_24px]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-[#b6c4ff] fill-[#b6c4ff]/20" />
              <span className="font-bold text-2xl tracking-tight">GuardianDesk</span>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-[#b6c4ff] backdrop-blur-sm border border-white/15">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Parental Control Engine v2.4</span>
            </div>
            <h2 className="font-bold text-3xl lg:text-4xl leading-tight">Peace of mind for the digital generation.</h2>
            <p className="text-base text-[#b6c4ff]/90 leading-relaxed">
              Manage screen time, block inappropriate content, and stay connected with your family safely across all laptops, mobile phones, and tablets.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 text-xs text-[#b6c4ff]/80">
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
            </div>
            <span>Encrypted Guardian Mode • SOC2 Compliant</span>
          </div>
        </div>

        {/* Right Side: Auth Forms */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          {authMode === 'login' ? (
            <div className="animate-in fade-in duration-300">
              <header className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="font-bold text-3xl text-[#0d1c2d]">Welcome back</h1>
                  <button
                    onClick={() => setAuthMode('empty-state-demo')}
                    className="text-[11px] font-bold text-[#1e3a8a] bg-[#eef4ff] px-2.5 py-1 rounded-full hover:bg-[#d0e1fb] transition-colors"
                    title="Preview onboarding empty state"
                  >
                    ⚡ View Empty State Setup
                  </button>
                </div>
                <p className="text-sm text-[#444651]">Secure access to your parental dashboard.</p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#444651] block">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none transition-all text-sm font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#444651] block">
                      PASSWORD
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { setAuthError('Enter your email address first.'); return; }
                        const { error } = await supabase.auth.resetPasswordForEmail(email);
                        if (error) setAuthError(error.message);
                        else setAuthError('Password reset email sent — check your inbox.');
                      }}
                      className="text-xs text-[#1e3a8a] font-semibold hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none transition-all text-sm font-medium text-slate-800"
                  />
                </div>

                {/* Error / info banner */}
                {authError && (
                  <div className={`px-4 py-3 rounded-xl text-xs font-semibold border ${
                    authError.includes('sent') || authError.includes('check')
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#00236f] transition-all shadow-lg shadow-[#1e3a8a]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating Guardian Session...</span>
                    </>
                  ) : (
                    <span>Sign In to Dashboard</span>
                  )}
                </button>
              </form>

              <footer className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-sm text-[#444651]">
                  New to GuardianDesk?{' '}
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    className="text-[#1e3a8a] font-bold ml-1 hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </footer>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <header className="mb-8">
                <h1 className="font-bold text-3xl text-[#0d1c2d] mb-2">Create Account</h1>
                <p className="text-sm text-[#444651]">Start protecting your family's digital world.</p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#444651] block">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#444651] block">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#444651] block">
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none transition-all text-sm font-medium"
                  />
                </div>

                {authError && (
                  <div className="px-4 py-3 rounded-xl text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1e3a8a] text-white py-3.5 rounded-xl font-bold text-base hover:bg-[#00236f] transition-all shadow-lg shadow-[#1e3a8a]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Join GuardianDesk</span>
                  )}
                </button>
              </form>

              <footer className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-sm text-[#444651]">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className="text-[#1e3a8a] font-bold ml-1 hover:underline"
                  >
                    Log in here
                  </button>
                </p>
              </footer>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
