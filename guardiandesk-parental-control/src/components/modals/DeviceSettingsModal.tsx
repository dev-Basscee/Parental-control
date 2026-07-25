import React, { useState } from 'react';
import { Device } from '../../types';
import { Laptop, Smartphone, Tablet, Tv, X, Lock, Unlock, Save, Trash2 } from 'lucide-react';

interface DeviceSettingsModalProps {
  device: Device;
  onClose: () => void;
  onSave: (updatedDevice: Device) => void;
  onRemove: (id: string) => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  device,
  onClose,
  onSave,
  onRemove
}) => {
  const [name, setName] = useState(device.name);
  const [maxMinutes, setMaxMinutes] = useState(device.maxDailyMinutes);
  const [isLocked, setIsLocked] = useState(!!device.isLocked);

  const hours = Math.floor(maxMinutes / 60);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...device,
      name,
      maxDailyMinutes: maxMinutes,
      isLocked,
      status: isLocked ? 'blocked' : device.status
    });
    onClose();
  };

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'desktop':
      case 'laptop': return <Laptop className="w-6 h-6 text-[#00236f]" />;
      case 'phone': return <Smartphone className="w-6 h-6 text-[#00236f]" />;
      case 'tablet': return <Tablet className="w-6 h-6 text-[#00236f]" />;
      default: return <Tv className="w-6 h-6 text-[#00236f]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1c2d]/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-6 bg-[#eef4ff] border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-200/50">
              {getDeviceIcon(device.type)}
            </div>
            <div>
              <h2 className="font-bold text-lg text-[#0d1c2d]">Device Configuration</h2>
              <p className="text-xs text-[#444651]">{device.os}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block">
              Device Label
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#00236f] text-sm font-bold text-[#0d1c2d] outline-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-[#444651] uppercase tracking-wider">
                Daily Screen Time Allowance
              </label>
              <span className="text-xs font-bold text-[#00236f] bg-[#eef4ff] px-2.5 py-1 rounded-lg">
                {hours} {hours === 1 ? 'hour' : 'hours'} / day
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="600"
              step="30"
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(parseInt(e.target.value))}
              className="w-full py-1"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>30m</span>
              <span>5h</span>
              <span>10h</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-[#0d1c2d]">Instant Device Lock</p>
              <p className="text-xs text-[#444651] mt-0.5">Immediately disable all network & app access</p>
            </div>
            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isLocked 
                  ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a]' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { onRemove(device.id); onClose(); }}
              className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Unlink Device</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#1e3a8a] text-white text-xs font-bold rounded-xl hover:bg-[#00236f] transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
