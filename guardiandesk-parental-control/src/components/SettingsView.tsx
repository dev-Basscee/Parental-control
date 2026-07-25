import React, { useState } from 'react';
import { Device, UserProfile } from '../types';
import { 
  Laptop, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Trash2, 
  ChevronRight, 
  Plus, 
  Bell, 
  UserCircle, 
  LogOut, 
  Shield, 
  Check, 
  Sliders 
} from 'lucide-react';

interface SettingsViewProps {
  devices: Device[];
  onRemoveDevice: (id: string) => void;
  onOpenPairing: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  devices,
  onRemoveDevice,
  onOpenPairing,
  userProfile,
  onUpdateProfile,
  onLogout
}) => {
  const [notifBlocked, setNotifBlocked] = useState(true);
  const [notifScreenTime, setNotifScreenTime] = useState(true);
  const [notifDailySummary, setNotifDailySummary] = useState(false);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(userProfile.email);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ email: newEmail });
    setIsEditingEmail(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'desktop':
      case 'laptop': return <Monitor className="w-5 h-5 text-[#505f76]" />;
      case 'phone': return <Smartphone className="w-5 h-5 text-[#505f76]" />;
      case 'tablet': return <Tablet className="w-5 h-5 text-[#505f76]" />;
      default: return <Laptop className="w-5 h-5 text-[#505f76]" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl md:text-3xl text-[#0d1c2d] mb-1.5">Settings</h1>
          {isSaved && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Preferences saved
            </span>
          )}
        </div>
        <p className="text-sm text-[#444651]">Manage your account preferences and paired child devices.</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* Category: Paired Devices */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <Laptop className="w-5 h-5 text-[#00236f]" />
              <h3 className="font-bold text-lg text-[#0d1c2d]">Paired Devices</h3>
            </div>
            <span className="text-xs font-bold bg-[#eef4ff] text-[#00236f] px-2.5 py-0.5 rounded-full">
              {devices.length} Active
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {devices.map((device) => (
              <li
                key={device.id}
                className="p-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f8f9ff] flex items-center justify-center border border-slate-200/60">
                    {getDeviceIcon(device.type)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#0d1c2d]">{device.name}</p>
                    <p className="text-xs text-[#444651]">
                      {device.os.split('•')[0]} •{' '}
                      <span className={device.status === 'online' ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                        {device.status === 'online' ? 'Last active 5m ago' : 'Offline'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onRemoveDevice(device.id)}
                    className="p-2 text-slate-400 hover:text-[#ba1a1a] hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </li>
            ))}
          </ul>

          <div className="p-4 bg-[#f8f9ff] border-t border-slate-100">
            <button
              onClick={onOpenPairing}
              className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-[#444651] hover:border-[#00236f] hover:text-[#00236f] hover:bg-white transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Pair New Device</span>
            </button>
          </div>
        </section>

        {/* Category: Notifications */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/60 flex items-center gap-3 bg-slate-50/50">
            <Bell className="w-5 h-5 text-[#00236f]" />
            <h3 className="font-bold text-lg text-[#0d1c2d]">Notifications</h3>
          </div>

          <ul className="divide-y divide-slate-100">
            <li className="p-6 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#0d1c2d]">Blocked Attempt Alerts</p>
                <p className="text-xs text-[#444651] mt-0.5">Get notified immediately when a child tries to access a restricted site.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={notifBlocked}
                  onChange={(e) => setNotifBlocked(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </li>

            <li className="p-6 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#0d1c2d]">Screen Time Warnings</p>
                <p className="text-xs text-[#444651] mt-0.5">Push alerts when a device is within 15 minutes of its daily screen time limit.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={notifScreenTime}
                  onChange={(e) => setNotifScreenTime(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </li>

            <li className="p-6 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#0d1c2d]">Daily Summary</p>
                <p className="text-xs text-[#444651] mt-0.5">Receive an automated email report of all activity at 8:00 PM.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={notifDailySummary}
                  onChange={(e) => setNotifDailySummary(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </li>
          </ul>
        </section>

        {/* Category: Account Settings */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/60 flex items-center gap-3 bg-slate-50/50">
            <UserCircle className="w-5 h-5 text-[#00236f]" />
            <h3 className="font-bold text-lg text-[#0d1c2d]">Account Settings</h3>
          </div>

          <ul className="divide-y divide-slate-100">
            <li className="p-6">
              {isEditingEmail ? (
                <form onSubmit={handleSaveEmail} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">New Email Address</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#00236f]"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-[#00236f] text-white rounded-xl text-xs font-bold">Save</button>
                  <button type="button" onClick={() => setIsEditingEmail(false)} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Cancel</button>
                </form>
              ) : (
                <div 
                  onClick={() => setIsEditingEmail(true)}
                  className="flex items-center justify-between hover:bg-slate-50/70 transition-colors cursor-pointer -m-6 p-6 group"
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-0.5">Email Address</p>
                    <p className="font-bold text-sm text-[#0d1c2d]">{userProfile.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#00236f] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}
            </li>

            <li 
              onClick={() => alert("Password recovery instruction sent to your email.")}
              className="p-6 flex items-center justify-between hover:bg-slate-50/70 transition-colors group cursor-pointer"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-0.5">Password</p>
                <p className="font-bold text-sm text-[#0d1c2d] tracking-widest">••••••••••••</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
            </li>

            <li 
              onClick={() => alert("Your Guardian Pro subscription is active until Nov 24, 2026.")}
              className="p-6 flex items-center justify-between hover:bg-slate-50/70 transition-colors group cursor-pointer"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-0.5">Subscription Plan</p>
                <p className="font-bold text-sm text-[#00236f]">{userProfile.subscriptionPlan}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </li>
          </ul>
        </section>

        {/* Logout Button */}
        <div className="pt-6 flex flex-col items-center">
          <button
            onClick={onLogout}
            className="w-full max-w-xs py-3.5 bg-[#1e3a8a] text-white rounded-full font-bold text-sm hover:bg-[#00236f] hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Session</span>
          </button>
          <p className="mt-4 text-xs font-semibold text-[#444651] text-center flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>GuardianDesk v2.4.1 • Secure & Encrypted</span>
          </p>
        </div>
      </div>
    </div>
  );
};
