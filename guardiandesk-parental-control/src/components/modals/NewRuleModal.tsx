import React, { useState } from 'react';
import { Ban, Clock, Calendar, X } from 'lucide-react';

interface NewRuleModalProps {
  onClose: () => void;
  onConfirm: (ruleData: {
    title: string;
    type: 'forever' | 'temporary' | 'schedule';
    hours?: number;
    days?: string[];
    startTime?: string;
    endTime?: string;
  }) => void;
}

export const NewRuleModal: React.FC<NewRuleModalProps> = ({ onClose, onConfirm }) => {
  const [ruleTitle, setRuleTitle] = useState("Social Media Hub & Games");
  const [blockType, setBlockType] = useState<'forever' | 'temporary' | 'schedule'>('temporary');
  const [hours, setHours] = useState<number>(4);
  
  const [selectedDays, setSelectedDays] = useState<string[]>(['M', 'T', 'W', 'T', 'F']);
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("07:00");

  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const toggleDay = (day: string, idx: number) => {
    const key = `${day}-${idx}`;
    if (selectedDays.includes(key) || selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day && d !== key));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      title: ruleTitle,
      type: blockType,
      hours: blockType === 'temporary' ? hours : undefined,
      days: blockType === 'schedule' ? selectedDays : undefined,
      startTime: blockType === 'schedule' ? startTime : undefined,
      endTime: blockType === 'schedule' ? endTime : undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1c2d]/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-all transform scale-100 animate-in zoom-in-95 duration-200 border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 bg-[#eef4ff] border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a] shadow-xs">
              <Ban className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-[#00236f]">New Block Rule</h2>
              <input
                type="text"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                className="text-xs text-[#444651] bg-transparent border-b border-dashed border-slate-400 focus:border-[#00236f] focus:outline-none w-full font-medium pb-0.5 mt-0.5"
                placeholder="Rule or App Name..."
              />
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block">
              Select Restriction Type
            </label>

            {/* Option 1: Forever */}
            <label 
              onClick={() => setBlockType('forever')}
              className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                blockType === 'forever' 
                  ? 'border-[#00236f] bg-[#eef4ff]/60 shadow-xs' 
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input 
                type="radio" 
                name="block_type" 
                checked={blockType === 'forever'}
                onChange={() => setBlockType('forever')}
                className="w-5 h-5 text-[#00236f] focus:ring-[#00236f] border-slate-300"
              />
              <div className="ml-3">
                <p className="font-bold text-sm text-[#0d1c2d]">Block Forever</p>
                <p className="text-xs text-[#444651] mt-0.5">Complete access restriction until manually removed.</p>
              </div>
            </label>

            {/* Option 2: X Hours (Temporary) */}
            <div 
              onClick={() => setBlockType('temporary')}
              className={`rounded-xl border p-4 space-y-4 transition-all cursor-pointer ${
                blockType === 'temporary' 
                  ? 'border-[#00236f] bg-[#eef4ff]/60 shadow-xs' 
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <label className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="block_type" 
                  checked={blockType === 'temporary'}
                  onChange={() => setBlockType('temporary')}
                  className="w-5 h-5 text-[#00236f] focus:ring-[#00236f] border-slate-300"
                />
                <div className="ml-3">
                  <p className="font-bold text-sm text-[#0d1c2d]">Block for specific time</p>
                </div>
              </label>

              {blockType === 'temporary' && (
                <div className="pl-8 space-y-2 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#444651]">Duration</span>
                    <span className="font-bold text-xs text-[#00236f] bg-[#1e3a8a]/10 px-2.5 py-1 rounded-lg">
                      {hours} {hours === 1 ? 'Hour' : 'Hours'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="24" 
                    step="1" 
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value))}
                    className="w-full py-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>1h</span>
                    <span>12h</span>
                    <span>24h</span>
                  </div>
                </div>
              )}
            </div>

            {/* Option 3: Schedule */}
            <div 
              onClick={() => setBlockType('schedule')}
              className={`rounded-xl border p-4 space-y-4 transition-all cursor-pointer ${
                blockType === 'schedule' 
                  ? 'border-[#00236f] bg-[#eef4ff]/60 shadow-xs' 
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <label className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="block_type" 
                  checked={blockType === 'schedule'}
                  onChange={() => setBlockType('schedule')}
                  className="w-5 h-5 text-[#00236f] focus:ring-[#00236f] border-slate-300"
                />
                <div className="ml-3">
                  <p className="font-bold text-sm text-[#0d1c2d]">Block on a Schedule</p>
                </div>
              </label>

              {blockType === 'schedule' && (
                <div className="pl-8 space-y-3 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-7 gap-1.5 mt-2">
                    {daysOfWeek.map((dayLabel, idx) => {
                      const isSelected = selectedDays.includes(dayLabel);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(dayLabel, idx)}
                          className={`w-8 h-8 rounded-full text-[11px] font-bold transition-colors flex items-center justify-center ${
                            isSelected 
                              ? 'bg-[#1e3a8a] text-white shadow-xs' 
                              : 'border border-slate-300 text-slate-600 hover:bg-[#e5efff]'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-4 mt-3">
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-[#444651] block mb-1">START TIME</span>
                      <input 
                        type="time" 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl text-xs font-bold p-2 outline-none focus:border-[#00236f]"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-[#444651] block mb-1">END TIME</span>
                      <input 
                        type="time" 
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl text-xs font-bold p-2 outline-none focus:border-[#00236f]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-[#f8f9ff] flex items-center justify-end gap-3 border-t border-slate-200/60">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold text-[#444651] hover:bg-slate-200/60 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className="px-8 py-2.5 bg-[#1e3a8a] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#1e3a8a]/20 active:scale-95 hover:bg-[#00236f] transition-all flex items-center gap-1.5"
          >
            <span>Confirm Rule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
