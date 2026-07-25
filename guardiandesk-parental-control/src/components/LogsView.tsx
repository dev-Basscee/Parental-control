import React, { useState, useEffect } from 'react';
import { ActivityLogEvent } from '../types';
import { supabase } from '../lib/supabase';
import { 
  Filter, 
  Download, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  Laptop, 
  SearchCode, 
  Moon, 
  X
} from 'lucide-react';

interface LogsViewProps {
  logs: ActivityLogEvent[];
  /** Called when a new realtime log arrives so App.tsx state stays in sync */
  onNewLog: (log: ActivityLogEvent) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onNewLog }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ── Realtime subscription ──────────────────────────────────────────────────
  // Subscribe to INSERT events on activity_log.  Any new row pushed by the
  // agent via the report-activity Edge Function will appear here instantly.
  useEffect(() => {
    const channel = supabase
      .channel('activity_log_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const row = payload.new as {
            id: string;
            action: string;
            created_at: string;
            device_id: string;
            metadata: Record<string, unknown> | null;
          };

          // Map the Supabase row to our frontend ActivityLogEvent shape
          const evt: ActivityLogEvent = {
            id:          row.id,
            title:       String(row.action).replace(/_/g, ' '),
            timestamp:   new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateGroup:   'Today, ' + new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            type:        mapActionToType(row.action),
            deviceName:  (row.metadata?.device_name as string) || row.device_id,
            description: (row.metadata?.description as string) || row.action,
            iconName:    mapActionToIcon(row.action),
          };

          onNewLog(evt);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onNewLog]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || log.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Group filtered logs by dateGroup
  const dateGroups: { [key: string]: ActivityLogEvent[] } = {};
  filteredLogs.forEach(log => {
    if (!dateGroups[log.dateGroup]) {
      dateGroups[log.dateGroup] = [];
    }
    dateGroups[log.dateGroup].push(log);
  });

  const getLogIcon = (_iconName: string, type: ActivityLogEvent['type']) => {
    switch (type) {
      case 'blocked':   return <ShieldAlert className="w-4 h-4 text-[#ba1a1a]" />;
      case 'unblocked': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'connected': return <Laptop className="w-4 h-4 text-[#00236f]" />;
      case 'browsing':  return <SearchCode className="w-4 h-4 text-slate-600" />;
      default:          return <Moon className="w-4 h-4 text-indigo-600" />;
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Time,Event Title,Device,Type,Details\n"
      + filteredLogs.map(l => `"${l.dateGroup}","${l.timestamp}","${l.title}","${l.deviceName}","${l.type}","${l.description}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `guardiandesk_activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl text-[#0d1c2d] mb-1.5">Activity Logs</h1>
          <p className="text-sm text-[#444651]">Real-time oversight of digital activity across all managed devices.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search timeline..."
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`bg-white border px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
                selectedType !== 'all' ? 'border-[#00236f] text-[#00236f] bg-[#eef4ff]' : 'border-slate-200 text-[#444651] hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{selectedType === 'all' ? 'Filter' : `Filter: ${selectedType}`}</span>
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Event Type</div>
                  {['all', 'blocked', 'unblocked', 'connected', 'browsing'].map(t => (
                    <button
                      key={t}
                      onClick={() => { setSelectedType(t); setIsFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold capitalize flex items-center justify-between hover:bg-slate-50 ${
                        selectedType === t ? 'bg-[#eef4ff] text-[#00236f] font-bold' : 'text-slate-700'
                      }`}
                    >
                      <span>{t === 'all' ? '● All Events' : t}</span>
                      {selectedType === t && <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleExport}
            className="bg-[#1e3a8a] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#00236f] transition-all shadow-md shadow-[#1e3a8a]/15 active:scale-95"
            title="Download CSV report"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Activity Timeline Section */}
      <section className="space-y-8 relative">
        {Object.keys(dateGroups).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <p className="text-sm font-bold text-slate-700 mb-1">No activity events found</p>
            <p className="text-xs text-slate-400">Try adjusting your search filter or checking back later.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedType('all'); }}
              className="mt-4 px-4 py-2 bg-[#eef4ff] text-[#00236f] rounded-xl text-xs font-bold hover:bg-[#d0e1fb] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          Object.entries(dateGroups).map(([dateLabel, events]) => (
            <div key={dateLabel} className="flex flex-col gap-6">
              {/* Date Header */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-[#00236f] uppercase tracking-wider">{dateLabel}</span>
                <div className="flex-1 h-[1px] bg-slate-200/60" />
              </div>

              {/* Timeline Items for this date */}
              <div className="space-y-5">
                {events.map((log, lIndex) => (
                  <div key={log.id || lIndex} className="timeline-item relative flex gap-6 group">
                    {/* Timeline dot & line */}
                    <div className="timeline-line flex-shrink-0 w-6 h-6 flex items-center justify-center z-10">
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-125 ${
                        log.type === 'blocked' ? 'bg-[#ba1a1a]' :
                        log.type === 'unblocked' ? 'bg-emerald-500' :
                        log.type === 'connected' ? 'bg-[#00236f]' : 'bg-slate-400'
                      }`} />
                    </div>

                    {/* Event Glass Card */}
                    <div className="flex-1 glass-card p-5 rounded-2xl ambient-shadow hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 border border-slate-200/80">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`text-base font-bold ${
                          log.title.toLowerCase().includes('blocked') ? 'text-[#ba1a1a]' : 'text-[#0d1c2d]'
                        }`}>
                          {log.title}
                        </h3>
                        <span className="text-[11px] font-semibold text-[#444651] bg-[#eef4ff] px-2.5 py-0.5 rounded-md border border-[#d0e1fb]/60">
                          {log.timestamp}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#444651]">
                        <div className="p-1 rounded bg-slate-100 flex-shrink-0">
                          {getLogIcon(log.iconName, log.type)}
                        </div>
                        <p className="leading-relaxed">
                          {log.description.split('on ')[0]}
                          {log.description.includes('on ') && (
                            <>on <span className="font-bold text-[#0d1c2d]">{log.deviceName}</span></>
                          )}
                          {!log.description.includes('on ') && (
                            <span className="font-bold text-[#0d1c2d]"> • {log.deviceName}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapActionToType(action: string): ActivityLogEvent['type'] {
  if (action.includes('block') || action.includes('kill')) return 'blocked';
  if (action.includes('unblock') || action.includes('allow')) return 'unblocked';
  if (action.includes('connect') || action.includes('pair') || action.includes('restart')) return 'connected';
  if (action.includes('browse') || action.includes('url')) return 'browsing';
  return 'settings';
}

function mapActionToIcon(action: string): string {
  if (action.includes('block')) return 'block';
  if (action.includes('connect') || action.includes('pair')) return 'laptop_windows';
  if (action.includes('restart')) return 'refresh';
  return 'info';
}
