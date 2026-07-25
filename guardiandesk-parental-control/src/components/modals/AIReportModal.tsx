import React, { useState } from 'react';
import { Device, AppRule } from '../../types';
import { Sparkles, BarChart3, ShieldCheck, Check, AlertTriangle, X, RefreshCw, Download, Share2 } from 'lucide-react';

interface AIReportModalProps {
  onClose: () => void;
  devices: Device[];
  appRules: AppRule[];
}

export const AIReportModal: React.FC<AIReportModalProps> = ({ onClose, devices, appRules }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  
  const totalScreenTime = devices.reduce((acc, d) => acc + d.screenTimeTodayMinutes, 0);
  const totalHours = (totalScreenTime / 60).toFixed(1);

  const handleRegenerate = () => {
    setIsGenerating(true);
    setReportReady(false);
    setTimeout(() => {
      setIsGenerating(false);
      setReportReady(true);
    }, 1500);
  };

  const handleDownloadReport = () => {
    const reportText = `GuardianDesk AI Wellbeing Report\nGenerated: ${new Date().toLocaleDateString()}\n\nSummary:\n- Total Family Screen Time Today: ${totalHours} hours across ${devices.length} devices.\n- Educational Activity: Up 20% compared to last week.\n- Gaming / Entertainment: Limited to 60 minutes daily on Roblox.\n- AI Threat Detection: 12 explicit/spam attempts blocked automatically.\n\nRecommendations:\n1. Maintain Homework Window (4pm-6pm) on PC nodes.\n2. Consider adding an extra 30 minutes of unstructured reading time.`;
    
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GuardianDesk_AI_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1c2d]/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#b6c4ff_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1">
                <span>GEMINI AI ENGINE v2.4</span>
              </div>
              <h2 className="font-bold text-xl leading-tight">Family Digital Wellbeing Report</h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isGenerating ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#eef4ff] border-t-[#00236f] animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-base text-[#0d1c2d]">Analyzing family usage telemetry...</p>
                <p className="text-xs text-[#444651] mt-1">Comparing screen time, educational ratio, and safety logs across {devices.length} devices.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Summary Stats */}
              <div className="grid grid-cols-3 gap-4 bg-[#f8f9ff] p-4 rounded-xl border border-slate-200/80">
                <div className="text-center border-r border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Time Today</span>
                  <span className="font-extrabold text-xl text-[#0d1c2d]">{totalHours} hrs</span>
                </div>
                <div className="text-center border-r border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Education Ratio</span>
                  <span className="font-extrabold text-xl text-emerald-600">62%</span>
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Threats Filtered</span>
                  <span className="font-extrabold text-xl text-[#00236f]">12 Events</span>
                </div>
              </div>

              {/* AI Key Insights */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#0d1c2d] uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#00236f]" />
                  <span>Key Observations this week</span>
                </h3>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-emerald-500 text-white mt-0.5">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-950">High Educational Productivity</p>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                        Leo spent <span className="font-bold">2h 45m in VSCode</span> and <span className="font-bold">1h 30m on Khan Academy</span>. This represents a 20% positive increase in learning modules compared to last week.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-[#00236f] text-white mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#00236f]">Bedtime Mode Compliance</p>
                      <p className="text-xs text-[#0d1c2d] mt-0.5 leading-relaxed">
                        All devices automatically locked at 9:00 PM yesterday without manual override attempts. Sleep hygiene routines are stable.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-amber-500 text-white mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-950">Roblox Limit Reached</p>
                      <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                        Leo reached the 60-minute daily gaming limit on <span className="font-semibold">Roblox.exe</span> at 2:30 PM. The system smoothly transition to blocked state.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom AI Query Input */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-[#444651] uppercase tracking-wider block mb-2">
                  Ask AI Advisor for custom parenting rules
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g. Suggest a fair weekend schedule for a 12-year-old..."
                    className="flex-1 bg-[#f8f9ff] border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:border-[#00236f]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customPrompt) {
                        alert(`AI Recommendation: For weekends, consider extending gaming limits by 30 minutes after completing morning study tasks.`);
                        setCustomPrompt('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customPrompt) {
                        alert(`AI Recommendation: For weekends, consider extending gaming limits by 30 minutes after completing morning study tasks.`);
                        setCustomPrompt('');
                      }
                    }}
                    className="bg-[#00236f] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs"
                  >
                    Ask AI
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-[#f8f9ff] border-t border-slate-200/60 flex justify-between items-center">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="text-xs font-bold text-[#00236f] hover:underline flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate Analysis</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-white border border-slate-200 text-[#0d1c2d] rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Summary</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#1e3a8a] text-white rounded-xl text-xs font-bold hover:bg-[#00236f] transition-all shadow-md active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
