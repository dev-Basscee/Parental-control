import React, { useState } from 'react';
import { Device, AppRule, ActivityLogEvent } from '../types';
import { 
  ShieldAlert, 
  Timer, 
  Wifi, 
  Search, 
  Filter, 
  Gamepad2, 
  Code, 
  MessageSquare, 
  Film, 
  GraduationCap, 
  Share2, 
  Settings, 
  Calendar, 
  BarChart3,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  devices: Device[];
  appRules: AppRule[];
  onToggleAppRule: (appId: string) => void;
  recentLogs: ActivityLogEvent[];
  onOpenAIReport: () => void;
  onViewAllApps: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  devices,
  appRules,
  onToggleAppRule,
  recentLogs,
  onOpenAIReport,
  onViewAllApps
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredApps = appRules.filter(app => {
    const matchesSearch = app.appName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (app.executableName && app.executableName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = filterCategory === 'all' || app.category.toLowerCase().includes(filterCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  const getAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'sports_esports': return <Gamepad2 className="w-5 h-5 text-slate-600" />;
      case 'code': return <Code className="w-5 h-5 text-[#00236f]" />;
      case 'forum': return <MessageSquare className="w-5 h-5 text-[#5865F2]" />;
      case 'movie': return <Film className="w-5 h-5 text-rose-600" />;
      case 'school': return <GraduationCap className="w-5 h-5 text-blue-600" />;
      case 'share': return <Share2 className="w-5 h-5 text-purple-600" />;
      default: return <Gamepad2 className="w-5 h-5 text-slate-600" />;
    }
  };

  // ── Computed summary values from live data ─────────────────────────────────
  const blockedCount  = appRules.filter(a => a.isBlocked).length;
  const onlineDevices = devices.filter(d => d.status === 'online' && !d.isLocked);
  const primaryDevice = onlineDevices[0] ?? devices[0] ?? null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="font-bold text-2xl md:text-3xl text-[#0d1c2d] mb-4">Dashboard Overview</h2>

        {/* Summary Cards Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Apps Blocked */}
          <div className="ambient-shadow bg-white p-6 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#444651] uppercase tracking-wider">Apps Blocked</span>
              <ShieldAlert className="w-5 h-5 text-[#ba1a1a]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-3xl md:text-4xl text-[#0d1c2d]">{blockedCount}</span>
              <span className="text-[#444651] text-sm font-medium">
                {blockedCount === 0 ? 'No apps blocked' : `of ${appRules.length} total`}
              </span>
            </div>
          </div>

          {/* Screen Time — placeholder until agent reports it */}
          <div className="ambient-shadow bg-white p-6 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#444651] uppercase tracking-wider">Screen Time</span>
              <Timer className="w-5 h-5 text-[#00236f]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-3xl md:text-4xl text-[#0d1c2d]">
                {primaryDevice
                  ? `${Math.floor(primaryDevice.screenTimeTodayMinutes / 60)}h ${primaryDevice.screenTimeTodayMinutes % 60}m`
                  : '—'}
              </span>
              {primaryDevice && (
                <span className="text-[#444651] text-sm font-medium">{primaryDevice.name}</span>
              )}
            </div>
            {primaryDevice && (
              <div className="w-full bg-[#eef4ff] h-2 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-[#00236f] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((primaryDevice.screenTimeTodayMinutes / (primaryDevice.maxDailyMinutes || 240)) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Device Status */}
          <div className="ambient-shadow bg-white p-6 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold text-[#444651] uppercase tracking-wider">Device Status</span>
              <Wifi className={`w-5 h-5 ${onlineDevices.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-3xl md:text-4xl text-[#0d1c2d]">
                {onlineDevices.length > 0 ? 'Online' : devices.length === 0 ? 'No devices' : 'Offline'}
              </span>
              <span className="text-[#444651] text-sm font-medium">
                {devices.length > 0 ? `${onlineDevices.length}/${devices.length} active` : 'Pair a device'}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {onlineDevices.length > 0 ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 rhythmic-pulse" />
                  <span className="text-sm text-emerald-600 font-bold">
                    {onlineDevices.length} device{onlineDevices.length > 1 ? 's' : ''} online
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-sm text-slate-500 font-semibold">No devices online</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Application Rules Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-xl text-[#0d1c2d]">Application Rules</h3>
            <p className="text-xs text-[#444651] mt-0.5">Real-time filtering and access permissions</p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444651]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps, executables..."
                className="w-full pl-10 pr-4 py-2 bg-[#f8f9ff] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#00236f] text-sm font-medium transition-all"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-[#f8f9ff] border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e3a8a]/20"
            >
              <option value="all">All Categories</option>
              <option value="games">Gaming & Entertainment</option>
              <option value="education">Education</option>
              <option value="social">Social & Messaging</option>
            </select>
          </div>
        </div>

        {/* Apps Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eef4ff] border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-[#444651] uppercase tracking-wider">Application</th>
                <th className="px-6 py-3 text-xs font-bold text-[#444651] uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-xs font-bold text-[#444651] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-[#444651] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.slice(0, 4).map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e5efff] flex items-center justify-center border border-slate-200/50 shadow-xs">
                        {getAppIcon(app.iconName)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#0d1c2d] group-hover:text-[#00236f] transition-colors">{app.executableName || app.appName}</p>
                        <p className="text-xs text-[#444651]">{app.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-sm text-[#444651]">
                    {app.usageTodayMinutes > 0 ? `${Math.floor(app.usageTodayMinutes / 60)}h ${app.usageTodayMinutes % 60}m today` : '0m today'}
                  </td>
                  <td className="px-6 py-4">
                    {app.status === 'Blocked' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffdad6] text-[#93000a] text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
                        Blocked
                      </span>
                    )}
                    {app.status === 'Allowed' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Allowed
                      </span>
                    )}
                    {app.status === 'Scheduled' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d0e1fb] text-[#54647a] text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]" />
                        Scheduled
                      </span>
                    )}
                    {app.status === 'Limited' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Limited
                      </span>
                    )}
                    {app.status === 'Unrestricted' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Unrestricted
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => onToggleAppRule(app.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          app.isBlocked
                            ? 'bg-[#00236f] text-white hover:bg-[#1e3a8a] shadow-sm'
                            : 'bg-[#dbe9ff] text-[#444651] hover:bg-[#ffdad6] hover:text-[#ba1a1a]'
                        }`}
                      >
                        {app.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                      <button 
                        onClick={onViewAllApps}
                        className="p-1.5 rounded-xl text-[#444651] hover:bg-[#e5efff] transition-colors"
                        title="Configure application rules"
                      >
                        {app.status === 'Scheduled' ? <Calendar className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#eef4ff] text-center border-t border-slate-100">
          <button 
            onClick={onViewAllApps}
            className="text-[#00236f] text-xs font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>View All Applications ({appRules.length})</span>
            <span>→</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="ambient-shadow bg-white p-6 rounded-2xl border border-slate-200/80">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-xl text-[#0d1c2d]">Live Activity</h4>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              UPDATED JUST NOW
            </span>
          </div>

          <div className="space-y-5">
            {recentLogs.slice(0, 3).map((log, index) => (
              <div key={log.id || index} className="flex gap-4 items-start">
                <div className={`w-1 rounded-full h-10 shrink-0 ${
                  log.type === 'blocked' ? 'bg-[#ba1a1a]' :
                  log.type === 'unblocked' ? 'bg-emerald-500' :
                  log.type === 'connected' ? 'bg-[#1e3a8a]' : 'bg-[#d0e1fb]'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-[#0d1c2d]">
                    <span className="font-bold">{log.title.split(' ')[0]}</span>{' '}
                    {log.title.substring(log.title.indexOf(' ') + 1)}
                  </p>
                  <p className="text-xs text-[#444651] mt-0.5">
                    {log.timestamp} • {log.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visualization Card */}
        <div className="ambient-shadow bg-white p-6 rounded-2xl border border-slate-200/80 relative overflow-hidden flex flex-col justify-end min-h-[220px] group">
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-[#eef4ff] text-[#00236f] px-2.5 py-1 rounded-full text-xs font-bold mb-3">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Weekly AI Analysis</span>
            </div>
            <h4 className="font-bold text-xl text-[#0d1c2d] mb-1.5">Usage Insights</h4>
            <p className="text-sm text-[#444651] mb-6 leading-relaxed">
              Leo is using <span className="font-bold text-emerald-600">20% more educational apps</span> (Khan Academy & VSCode) than last week.
            </p>
            <button
              onClick={onOpenAIReport}
              className="bg-[#1e3a8a] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#00236f] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#1e3a8a]/15 active:scale-95 w-full sm:w-auto"
            >
              <span>Generate Full Report</span>
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
