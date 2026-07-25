import React from 'react';
import { NavTab, UserProfile } from '../types';
import { 
  LayoutDashboard, 
  Smartphone, 
  Gavel, 
  History, 
  Settings, 
  ShieldCheck, 
  UserCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  userProfile: UserProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userProfile }) => {
  return (
    <>
      {/* Desktop Left Sidebar (Fixed / Sticky inside container) */}
      <aside className="hidden md:flex flex-col h-[calc(100vh-64px)] w-[260px] p-4 space-y-2 bg-white border-r border-[#c5c5d3]/30 flex-shrink-0 sticky top-16">
        <div className="px-3 py-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d0e1fb] flex items-center justify-center text-[#00236f] shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[#0d1c2d] truncate">Parental Control</p>
              <p className="text-[11px] text-[#444651] truncate">Guardian Mode Active</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#d0e1fb] text-[#1e3a8a] shadow-sm translate-x-1'
                : 'text-[#444651] hover:bg-[#eef4ff] hover:text-[#00236f]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs tracking-wide">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-[#d0e1fb] text-[#1e3a8a] shadow-sm translate-x-1'
                : 'text-[#444651] hover:bg-[#eef4ff] hover:text-[#00236f]'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            <span className="text-xs tracking-wide">Devices</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full font-bold transition-all ${
              activeTab === 'rules'
                ? 'bg-[#d0e1fb] text-[#1e3a8a] shadow-sm translate-x-1'
                : 'text-[#444651] hover:bg-[#eef4ff] hover:text-[#00236f]'
            }`}
          >
            <Gavel className="w-5 h-5" />
            <span className="text-xs tracking-wide">Time Limits & Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full font-bold transition-all ${
              activeTab === 'logs'
                ? 'bg-[#d0e1fb] text-[#1e3a8a] shadow-sm translate-x-1'
                : 'text-[#444651] hover:bg-[#eef4ff] hover:text-[#00236f]'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-xs tracking-wide">Activity Logs</span>
          </button>

          <div className="pt-4 border-t border-slate-100 my-2" />

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-[#d0e1fb] text-[#1e3a8a] shadow-sm translate-x-1'
                : 'text-[#444651] hover:bg-[#eef4ff] hover:text-[#00236f]'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs tracking-wide">Settings</span>
          </button>
        </nav>

        {/* Bottom Status Card */}
        <div className="mt-auto pt-4 border-t border-[#c5c5d3]/20">
          <div className="p-3 bg-[#eef4ff] rounded-xl border border-[#d0e1fb]/60 shadow-sm">
            <p className="text-[10px] font-bold text-[#444651] uppercase tracking-wider mb-1">Active Filter</p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 rhythmic-pulse" />
              <span className="text-xs font-bold text-[#0d1c2d]">Strict Mode Enabled</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-[#d0e1fb]/60 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#00236f]/10 flex items-center justify-center text-[#00236f]">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <p className="text-[11px] font-bold text-[#0d1c2d] truncate">{userProfile.name}</p>
                <p className="text-[10px] text-[#444651] truncate">Pro Guardian</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden border-t border-[#c5c5d3]/50 bg-white/95 backdrop-blur-lg shadow-2xl rounded-t-2xl py-1.5 px-4">
        <div className="flex justify-around items-center w-full max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all active:scale-90 ${
              activeTab === 'dashboard'
                ? 'bg-[#1e3a8a] text-white font-bold shadow-md'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all active:scale-90 ${
              activeTab === 'devices'
                ? 'bg-[#1e3a8a] text-white font-bold shadow-md'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Devices</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all active:scale-90 ${
              activeTab === 'rules'
                ? 'bg-[#1e3a8a] text-white font-bold shadow-md'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <Gavel className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all active:scale-90 ${
              activeTab === 'logs'
                ? 'bg-[#1e3a8a] text-white font-bold shadow-md'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl transition-all active:scale-90 ${
              activeTab === 'settings'
                ? 'bg-[#1e3a8a] text-white font-bold shadow-md'
                : 'text-[#444651] hover:text-[#00236f]'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
};
