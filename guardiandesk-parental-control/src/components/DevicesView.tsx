import React from 'react';
import { Device } from '../types';
import { 
  Laptop, 
  Tablet, 
  Tv, 
  Smartphone, 
  Plus, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Lock, 
  Unlock,
  Sliders
} from 'lucide-react';

interface DevicesViewProps {
  devices: Device[];
  onOpenPairing: () => void;
  onToggleLockDevice: (deviceId: string) => void;
  onOpenDeviceSettings: (device: Device) => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  devices,
  onOpenPairing,
  onToggleLockDevice,
  onOpenDeviceSettings
}) => {
  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'desktop':
      case 'laptop': return <Laptop className="w-8 h-8 text-[#00236f]" />;
      case 'tablet': return <Tablet className="w-8 h-8 text-[#00236f]" />;
      case 'hub':
      case 'tv': return <Tv className="w-8 h-8 text-[#00236f]" />;
      case 'phone': return <Smartphone className="w-8 h-8 text-[#00236f]" />;
      default: return <Laptop className="w-8 h-8 text-[#00236f]" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Action */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl md:text-3xl text-[#00236f] mb-1.5">Paired Devices</h2>
          <p className="text-sm text-[#505f76]">Manage and monitor the digital activity of your family's hardware.</p>
        </div>
        <button
          onClick={onOpenPairing}
          className="bg-[#00236f] text-white px-6 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:bg-[#1e3a8a] transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Pair New Device</span>
        </button>
      </section>

      {/* Bento Grid for Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => {
          const screenTimePercent = Math.min(100, Math.round((device.screenTimeTodayMinutes / (device.maxDailyMinutes || 240)) * 100));
          const hours = Math.floor(device.screenTimeTodayMinutes / 60);
          const minutes = device.screenTimeTodayMinutes % 60;
          
          return (
            <div
              key={device.id}
              className="glass-card ambient-shadow rounded-2xl p-6 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 group border border-slate-200/80"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-[#e5efff] rounded-xl text-[#00236f] shadow-xs group-hover:bg-[#d0e1fb] transition-colors">
                    {getDeviceIcon(device.type)}
                  </div>
                  
                  {/* Status Badge */}
                  {device.status === 'online' && !device.isLocked && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px] uppercase tracking-wider border border-emerald-200/50">
                      <span className="status-dot bg-emerald-500 rhythmic-pulse" />
                      <span>Online</span>
                    </div>
                  )}
                  {device.status === 'offline' && !device.isLocked && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border border-slate-200/50">
                      <span className="status-dot bg-slate-400" />
                      <span>Offline</span>
                    </div>
                  )}
                  {(device.status === 'limiting' || device.status === 'blocked' || device.isLocked) && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px] uppercase tracking-wider border border-amber-200/50">
                      <span className="status-dot bg-amber-500 animate-pulse" />
                      <span>{device.isLocked ? 'Locked' : 'Limiting'}</span>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-xl text-[#0d1c2d] mb-1 group-hover:text-[#00236f] transition-colors">
                  {device.name}
                </h3>
                <p className="text-xs font-medium text-[#757682] mb-6">{device.os}</p>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#505f76] font-medium">Screen Time Today</span>
                    <span className="text-xs font-bold text-[#0d1c2d]">
                      {hours > 0 ? `${hours}h ` : ''}{minutes}m
                    </span>
                  </div>
                  <div className="w-full bg-[#eef4ff] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        device.isLocked || screenTimePercent >= 90 ? 'bg-[#ba1a1a]' : 'bg-[#00236f]'
                      }`}
                      style={{ width: `${screenTimePercent}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-right text-slate-400">Limit: {Math.floor(device.maxDailyMinutes / 60)}h daily</p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => onOpenDeviceSettings(device)}
                  className="flex-1 py-2 text-xs font-bold text-[#505f76] bg-[#eef4ff] rounded-xl hover:bg-[#e5efff] hover:text-[#00236f] transition-all flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </button>
                <button 
                  onClick={() => onToggleLockDevice(device.id)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    device.isLocked || device.status === 'limiting'
                      ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a] shadow-sm'
                      : 'bg-[#ffdad6]/40 text-[#ba1a1a] hover:bg-[#ffdad6]'
                  }`}
                >
                  {device.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{device.isLocked ? 'Unlock Now' : 'Lock Now'}</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty Placeholder Slot */}
        <div 
          onClick={onOpenPairing}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-75 hover:opacity-100 hover:border-[#00236f] hover:bg-white/50 transition-all cursor-pointer group min-h-[280px]"
        >
          <div className="w-16 h-16 rounded-full bg-[#eef4ff] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#d0e1fb] transition-all duration-300 text-[#00236f]">
            <Plus className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h3 className="font-bold text-base text-[#0d1c2d] mb-1">Add another device</h3>
          <p className="text-xs text-[#757682] max-w-xs">Laptops, Consoles, Tablets, or Smart TVs</p>
        </div>
      </div>

      {/* System Health Section */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-2xl bg-[#00236f] text-white shadow-xl relative overflow-hidden mesh-bg">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold mb-4 backdrop-blur-sm border border-white/15">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Active Firewall Defense</span>
            </div>
            <h3 className="font-bold text-2xl mb-2">Network Security</h3>
            <p className="text-sm text-white/90 mb-6 leading-relaxed max-w-md">
              All {devices.length} connected family devices are currently protected by the GuardianDesk DNS filtering and AI threat prevention layer.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="px-4 py-3 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
                <span className="block text-[11px] uppercase font-bold text-white/70 tracking-wider">Threats Blocked</span>
                <span className="font-bold text-2xl text-white">12</span>
              </div>
              <div className="px-4 py-3 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
                <span className="block text-[11px] uppercase font-bold text-white/70 tracking-wider">Filters Active</span>
                <span className="font-bold text-2xl text-white">SafeSearch</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-2xl ambient-shadow border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-2xl text-[#00236f] mb-6">Status Overview</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0d1c2d]">System Integrity Check</p>
                  <p className="text-xs text-[#505f76] mt-0.5">All nodes and encryption certificates operating normally.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0d1c2d]">Last Synchronized</p>
                  <p className="text-xs text-[#505f76] mt-0.5">2 minutes ago • Auto-sync interval: 60 seconds</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>SOC2 Type II Verified</span>
            <span className="text-emerald-600 font-bold">● Zero Data Leaks</span>
          </div>
        </div>
      </section>
    </div>
  );
};
