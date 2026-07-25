import React, { useState } from 'react';
import { NavTab, Device, UserProfile } from '../types';
import { Shield, Laptop, ChevronDown, Bell, LogOut, Settings, User } from 'lucide-react';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  devices: Device[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  userProfile: UserProfile;
  onLogout: () => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  userProfile,
  onLogout,
  unreadCount = 2
}) => {
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || {
    name: "Leo's MacBook Pro",
    os: "All managed devices"
  };

  return (
    <header className="w-full sticky top-0 z-40 shadow-sm glass-header">
      <div className="flex justify-between items-center px-4 md:px-8 py-3 w-full max-w-[1280px] mx-auto">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
          >
            <Shield className="w-7 h-7 text-[#00236f] fill-[#00236f]/10" />
            <h1 className="font-bold text-xl text-[#00236f] tracking-tight">GuardianDesk</h1>
          </div>

          {/* Device Switcher Dropdown */}
          <div className="relative hidden md:block ml-6">
            <div 
              onClick={() => setIsDeviceDropdownOpen(!isDeviceDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#e5efff] rounded-full cursor-pointer hover:bg-[#d4e4fa] transition-colors group border border-[#c5c5d3]/40"
            >
              <Laptop className="w-4 h-4 text-[#00236f]" />
              <span className="text-xs font-semibold text-[#0d1c2d] max-w-[140px] truncate">
                {selectedDeviceId === 'all' ? "All Managed Devices" : selectedDevice.name}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#444651] transition-transform duration-200 ${isDeviceDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {isDeviceDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDeviceDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Filter by Device
                  </div>
                  <button
                    onClick={() => { setSelectedDeviceId('all'); setIsDeviceDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedDeviceId === 'all' ? 'bg-[#eef4ff] text-[#00236f] font-bold' : 'text-slate-700'}`}
                  >
                    <span>🌐 All Managed Devices ({devices.length})</span>
                    {selectedDeviceId === 'all' && <span className="w-2 h-2 rounded-full bg-[#00236f]" />}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {devices.map(device => (
                    <button
                      key={device.id}
                      onClick={() => { setSelectedDeviceId(device.id); setIsDeviceDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedDeviceId === device.id ? 'bg-[#eef4ff] text-[#00236f] font-bold' : 'text-slate-700'}`}
                    >
                      <div className="flex flex-col truncate">
                        <span className="truncate">{device.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{device.os}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        device.status === 'online' ? 'bg-emerald-500' :
                        device.status === 'limiting' ? 'bg-amber-500' : 'bg-slate-300'
                      }`} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Top Quick Links for Desktop */}
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`transition-colors ${activeTab === 'dashboard' ? 'text-[#00236f] font-bold' : 'text-[#444651] hover:text-[#00236f]'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('devices')} 
              className={`transition-colors ${activeTab === 'devices' ? 'text-[#00236f] font-bold' : 'text-[#444651] hover:text-[#00236f]'}`}
            >
              Devices
            </button>
            <button 
              onClick={() => setActiveTab('rules')} 
              className={`transition-colors ${activeTab === 'rules' ? 'text-[#00236f] font-bold' : 'text-[#444651] hover:text-[#00236f]'}`}
            >
              Rules
            </button>
            <button 
              onClick={() => setActiveTab('logs')} 
              className={`transition-colors ${activeTab === 'logs' ? 'text-[#00236f] font-bold' : 'text-[#444651] hover:text-[#00236f]'}`}
            >
              Logs
            </button>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-[#e5efff] rounded-full transition-colors relative text-[#444651] hover:text-[#00236f]"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 p-3 z-20">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Security Alerts</span>
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold">{unreadCount} New</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2 rounded-lg bg-red-50/60 border border-red-100 text-xs">
                      <p className="font-bold text-red-900">Roblox blocked on Child-PC</p>
                      <p className="text-[11px] text-red-700 mt-0.5">Daily time limit reached at 2:30 PM.</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-100 text-xs">
                      <p className="font-bold text-amber-900">Leo's Phone approaching limit</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">10 minutes remaining on screen time.</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 text-xs">
                      <p className="font-bold text-slate-800">New weekly AI report ready</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Khan Academy usage up 20% this week.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setShowNotifications(false); setActiveTab('logs'); }}
                    className="w-full mt-2 pt-2 border-t border-slate-100 text-center text-xs font-bold text-[#00236f] hover:underline block"
                  >
                    View All Activity Logs →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* User Profile Avatar Menu */}
          <div className="relative">
            <div 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-8 h-8 rounded-full overflow-hidden bg-[#d0e1fb] flex items-center justify-center cursor-pointer border border-[#c5c5d3] hover:ring-2 hover:ring-[#1e3a8a] transition-all"
            >
              <img 
                src={userProfile.avatarUrl} 
                alt="Guardian Avatar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>

            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800">{userProfile.name}</p>
                    <p className="text-xs text-slate-500 truncate">{userProfile.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{userProfile.role}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); setActiveTab('settings'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); setActiveTab('settings'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>{userProfile.subscriptionPlan}</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => { setIsUserMenuOpen(false); onLogout(); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout Session</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
