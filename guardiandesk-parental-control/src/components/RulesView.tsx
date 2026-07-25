import React from 'react';
import { QuickToggle, ActiveRule, AppRule } from '../types';
import { 
  Plus, 
  Zap, 
  Sparkles, 
  CalendarCheck, 
  Moon, 
  BookOpen, 
  Timer, 
  PlusCircle, 
  MoreVertical, 
  Film, 
  Gamepad2, 
  GraduationCap, 
  Share2, 
  ShieldAlert, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

interface RulesViewProps {
  quickToggles: QuickToggle[];
  onToggleQuick: (id: string) => void;
  activeRules: ActiveRule[];
  onToggleActiveRule: (id: string) => void;
  appRules: AppRule[];
  onToggleAppRule: (id: string) => void;
  onOpenCreateRuleModal: () => void;
  onOpenAIReport: () => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  quickToggles,
  onToggleQuick,
  activeRules,
  onToggleActiveRule,
  appRules,
  onToggleAppRule,
  onOpenCreateRuleModal,
  onOpenAIReport
}) => {
  const getRuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'bedtime': return <Moon className="w-5 h-5 text-[#00236f]" />;
      case 'menu_book': return <BookOpen className="w-5 h-5 text-[#00236f]" />;
      case 'timer': return <Timer className="w-5 h-5 text-[#00236f]" />;
      default: return <Clock className="w-5 h-5 text-[#00236f]" />;
    }
  };

  const getAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'movie': return <Film className="w-4 h-4 text-rose-600" />;
      case 'sports_esports': return <Gamepad2 className="w-4 h-4 text-slate-700" />;
      case 'school': return <GraduationCap className="w-4 h-4 text-blue-600" />;
      case 'share': return <Share2 className="w-4 h-4 text-purple-600" />;
      default: return <Gamepad2 className="w-4 h-4 text-slate-700" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Add Button */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl md:text-3xl text-[#00236f] mb-1.5">Content Control</h2>
          <p className="text-sm text-[#444651]">Manage boundaries and safety rules for your family devices.</p>
        </div>
        <button
          onClick={onOpenCreateRuleModal}
          className="bg-[#00236f] text-white font-semibold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-md hover:bg-[#1e3a8a] active:scale-95 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Create New Rule</span>
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Quick Toggles Panel (4 cols) */}
        <section className="md:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00236f] fill-[#00236f]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#444651]">Quick Toggles</h3>
            </div>

            <div className="space-y-3">
              {quickToggles.map((tog) => (
                <div
                  key={tog.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#eef4ff]/70 border border-slate-100 transition-all hover:border-[#b6c4ff]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white shadow-xs ${tog.colorClass}`}>
                      {tog.id === 'tog-1' && <ShieldAlert className="w-4 h-4 text-[#ba1a1a]" />}
                      {tog.id === 'tog-2' && <CheckCircle2 className="w-4 h-4 text-[#00236f]" />}
                      {tog.id === 'tog-3' && <Zap className="w-4 h-4 text-[#505f76]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0d1c2d]">{tog.title}</p>
                      <p className="text-[11px] text-[#444651]">{tog.description}</p>
                    </div>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={tog.enabled}
                      onChange={() => onToggleQuick(tog.id)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Card / AI Content Filtering */}
          <div className="relative overflow-hidden rounded-2xl bg-[#1e3a8a] p-6 text-white shadow-xl min-h-[220px] flex flex-col justify-end group">
            <div className="absolute inset-0 shimmer-effect pointer-events-none" />
            <div className="absolute top-4 right-4 opacity-20">
              <Sparkles className="w-20 h-20 group-hover:rotate-12 transition-transform duration-500" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold mb-3 backdrop-blur-sm border border-white/15">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>AI Deep Guard Active</span>
              </div>
              <h4 className="font-bold text-xl leading-tight">AI Content Filtering</h4>
              <p className="text-xs text-[#90a8ff] mt-2 leading-relaxed">
                Automatically detects and blocks harmful content, cyberbullying, and explicit media using real-time machine learning.
              </p>
              <button
                onClick={onOpenAIReport}
                className="mt-5 bg-white text-[#00236f] px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-100 transition-colors shadow-md active:scale-95 inline-flex items-center gap-1.5"
              >
                <span>Learn more</span>
                <span>→</span>
              </button>
            </div>
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#d0e1fb] rounded-full filter blur-3xl opacity-30 animate-pulse" />
          </div>
        </section>

        {/* Active Rules (8 cols) */}
        <section className="md:col-span-8 space-y-6">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#00236f]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#444651]">Active Rules</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeRules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white border border-slate-200/80 p-6 rounded-2xl ambient-shadow transition-all duration-300 ${
                  !rule.enabled ? 'opacity-70 bg-slate-50/50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-[#e5efff] rounded-xl">
                    {getRuleIcon(rule.iconName)}
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleActiveRule(rule.id)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <h4 className="font-bold text-base text-[#0d1c2d]">{rule.title}</h4>
                <p className="text-[#444651] text-xs mt-1 leading-relaxed">{rule.description}</p>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#444651] flex items-center gap-1.5 bg-[#f8f9ff] px-2.5 py-1 rounded-lg border border-slate-200/60">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{rule.schedule}</span>
                  </span>
                  <button
                    onClick={onOpenCreateRuleModal}
                    className="text-[#00236f] font-bold text-xs hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}

            {/* New Rule Placeholder Button */}
            <button
              onClick={onOpenCreateRuleModal}
              className="bg-[#eef4ff]/50 border-2 border-dashed border-slate-300 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 text-[#444651] hover:border-[#00236f] hover:bg-[#eef4ff] transition-all group min-h-[190px]"
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-[#00236f]">
                <PlusCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <span className="text-xs font-bold text-[#0d1c2d]">New Rule Template</span>
              <span className="text-[11px] text-slate-400">Time limits, schedules & blocklists</span>
            </button>
          </div>

          {/* App-Specific Table Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#444651]">App Specific Restrictions</span>
                <span className="text-[10px] bg-[#d0e1fb] text-[#00236f] px-2 py-0.5 rounded font-bold">{appRules.length} Apps</span>
              </div>
              <button 
                onClick={onOpenCreateRuleModal}
                className="text-xs font-bold text-[#00236f] hover:underline"
              >
                + Add Restriction
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-slate-100 text-xs text-[#444651]">
                  <tr>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-wider">App Name</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Limit</th>
                    <th className="px-6 py-3.5 text-right">Enable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {appRules.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#e5efff] flex items-center justify-center border border-slate-200/50">
                            {getAppIcon(app.iconName)}
                          </div>
                          <span className="font-bold text-[#0d1c2d] text-sm">{app.appName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#444651] font-medium">{app.category}</td>
                      <td className="px-6 py-4">
                        {app.isBlocked ? (
                          <div className="flex items-center gap-1.5 text-[#ba1a1a] font-bold">
                            <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                            <span>Blocked</span>
                          </div>
                        ) : app.status === 'Limited' ? (
                          <div className="flex items-center gap-1.5 text-orange-600 font-bold">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span>Limited</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Allowed</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#444651] font-medium">
                        {app.limitMinutes && app.limitMinutes > 0
                          ? `${Math.floor(app.limitMinutes / 60)}h ${app.limitMinutes % 60}m`
                          : app.isBlocked ? '0h 0m' : 'No Limit'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <label className="switch scale-90">
                          <input
                            type="checkbox"
                            checked={!app.isBlocked}
                            onChange={() => onToggleAppRule(app.id)}
                          />
                          <span className="slider" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
