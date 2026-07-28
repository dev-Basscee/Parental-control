import React, { useState } from 'react';
import { Ban, Clock, Calendar, X } from 'lucide-react';
import type { Device } from '../../types';

interface NewRuleModalProps {
  devices: Device[];
  onClose: () => void;
  onConfirm: (ruleData: {
    title: string;
    type: 'forever' | 'temporary' | 'schedule';
    hours?: number;
    days?: string[];
    startTime?: string;
    endTime?: string;
    deviceId: string;
  }) => void;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_KEYS   = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const NewRuleModal: React.FC<NewRuleModalProps> = ({ devices, onClose, onConfirm }) => {
  const [ruleTitle, setRuleTitle]   = useState('');
  const [blockType, setBlockType]   = useState<'forever' | 'temporary' | 'schedule'>('temporary');
  const [hours, setHours]           = useState<number>(4);
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [startTime, setStartTime]   = useState('20:00');
  const [endTime, setEndTime]       = useState('07:00');
  const [deviceId, setDeviceId]     = useState(devices[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const toggleDay = (key: string) => {
    setSelectedDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const handleConfirm = async () => {
    if (!ruleTitle.trim()) { setError('Enter an app or rule name.'); return; }
    if (!deviceId)         { setError('Select a device.'); return; }
    if (blockType === 'schedule' && selectedDays.length === 0) {
      setError('Select at least one day for the schedule.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        title:     ruleTitle.trim(),
        type:      blockType,
        hours:     blockType === 'temporary' ? hours : undefined,
        days:      blockType === 'schedule'  ? selectedDays : undefined,
        startTime: blockType === 'schedule'  ? startTime : undefined,
        endTime:   blockType === 'schedule'  ? endTime   : undefined,
        deviceId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1c2d]/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

        {/* Header */}
        <div className="p-6 bg-[#eef4ff] border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a]">
              <Ban className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-[#00236f]">New Block Rule</h2>
              <p className="text-xs text-[#444651] mt-0.5">Blocks a specific app on a device</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* App name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block">App / Rule Name</label>
            <input
              type="text"
              value={ruleTitle}
              onChange={(e) => setRuleTitle(e.target.value)}
              placeholder="e.g. Roblox, Discord, TikTok"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none text-sm font-medium"
            />
          </div>

          {/* Device picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block">Target Device</label>
            {devices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No devices paired yet — pair a device first.</p>
            ) : (
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/20 outline-none text-sm font-medium bg-white"
              >
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Block type */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block">Restriction Type</label>

            {/* Forever */}
            <label
              onClick={() => setBlockType('forever')}
              className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                blockType === 'forever' ? 'border-[#00236f] bg-[#eef4ff]/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input type="radio" name="block_type" checked={blockType === 'forever'} onChange={() => setBlockType('forever')}
                className="w-4 h-4 text-[#00236f]" />
              <div className="ml-3">
                <p className="font-bold text-sm text-[#0d1c2d]">Block Forever</p>
                <p className="text-xs text-[#444651] mt-0.5">Permanently blocked until manually removed.</p>
              </div>
            </label>

            {/* Temporary */}
            <div
              onClick={() => setBlockType('temporary')}
              className={`rounded-xl border p-4 space-y-3 transition-all cursor-pointer ${
                blockType === 'temporary' ? 'border-[#00236f] bg-[#eef4ff]/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <label className="flex items-center cursor-pointer">
                <input type="radio" name="block_type" checked={blockType === 'temporary'} onChange={() => setBlockType('temporary')}
                  className="w-4 h-4 text-[#00236f]" />
                <div className="ml-3">
                  <p className="font-bold text-sm text-[#0d1c2d]">Block for X Hours</p>
                </div>
              </label>
              {blockType === 'temporary' && (
                <div className="pl-7 space-y-1 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#444651]">Duration</span>
                    <span className="font-bold text-xs text-[#00236f] bg-[#1e3a8a]/10 px-2.5 py-1 rounded-lg">
                      {hours} {hours === 1 ? 'Hour' : 'Hours'}
                    </span>
                  </div>
                  <input type="range" min="1" max="24" step="1" value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value))}
                    className="w-full py-2" />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>1h</span><span>12h</span><span>24h</span>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule */}
            <div
              onClick={() => setBlockType('schedule')}
              className={`rounded-xl border p-4 space-y-3 transition-all cursor-pointer ${
                blockType === 'schedule' ? 'border-[#00236f] bg-[#eef4ff]/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <label className="flex items-center cursor-pointer">
                <input type="radio" name="block_type" checked={blockType === 'schedule'} onChange={() => setBlockType('schedule')}
                  className="w-4 h-4 text-[#00236f]" />
                <div className="ml-3">
                  <p className="font-bold text-sm text-[#0d1c2d]">Block on a Schedule</p>
                </div>
              </label>
              {blockType === 'schedule' && (
                <div className="pl-7 space-y-3 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_LABELS.map((label, idx) => {
                      const key = DAY_KEYS[idx];
                      const active = selectedDays.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => toggleDay(key)}
                          className={`h-8 rounded-full text-[11px] font-bold transition-colors ${
                            active ? 'bg-[#1e3a8a] text-white' : 'border border-slate-300 text-slate-600 hover:bg-[#e5efff]'
                          }`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-[#444651] block mb-1">START</span>
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl text-xs font-bold p-2 outline-none focus:border-[#00236f]" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-[#444651] block mb-1">END</span>
                      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl text-xs font-bold p-2 outline-none focus:border-[#00236f]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-[#f8f9ff] flex items-center justify-end gap-3 border-t border-slate-200/60">
          <button onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold text-[#444651] hover:bg-slate-200/60 rounded-xl transition-all">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={submitting || devices.length === 0}
            className="px-8 py-2.5 bg-[#1e3a8a] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#1e3a8a]/20 active:scale-95 hover:bg-[#00236f] transition-all flex items-center gap-1.5 disabled:opacity-50">
            {submitting ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving…</span></>
            ) : (
              <span>Confirm Rule</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
