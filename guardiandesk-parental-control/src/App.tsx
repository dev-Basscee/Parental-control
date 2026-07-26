/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NavTab, Device, AppRule, ActiveRule, ActivityLogEvent, UserProfile } from './types';
import { initialProfile, initialActiveRules, initialQuickToggles } from './data/mockData';

import { supabase } from './lib/supabase';
import { loadDevices, loadApps, loadLogs, toggleAppStatus, dbDeviceToFrontend } from './lib/db';

import { Navbar }       from './components/Navbar';
import { Sidebar }      from './components/Sidebar';
import { AuthScreen }   from './components/AuthScreen';
import { PairingScreen } from './components/PairingScreen';
import { DashboardView } from './components/DashboardView';
import { DevicesView }   from './components/DevicesView';
import { RulesView }     from './components/RulesView';
import { LogsView }      from './components/LogsView';
import { SettingsView }  from './components/SettingsView';

import { NewRuleModal }        from './components/modals/NewRuleModal';
import { AIReportModal }       from './components/modals/AIReportModal';
import { DeviceSettingsModal } from './components/modals/DeviceSettingsModal';

export default function App() {
  // ── Auth state — null = resolving, true/false = known ─────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab]             = useState<NavTab>('dashboard');
  const [isPairingScreenOpen, setIsPairingScreenOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId]       = useState<string>('all');

  // ── Data state (starts empty — filled from DB after auth) ─────────────────
  const [userProfile, setUserProfile]   = useState<UserProfile>(initialProfile);
  const [devices, setDevices]           = useState<Device[]>([]);
  const [appRules, setAppRules]         = useState<AppRule[]>([]);
  const [activeRules, setActiveRules]   = useState<ActiveRule[]>(initialActiveRules);
  const [quickToggles, setQuickToggles] = useState(initialQuickToggles);
  const [logs, setLogs]                 = useState<ActivityLogEvent[]>([]);
  const [dataLoading, setDataLoading]   = useState(false);

  // ── Modals state ──────────────────────────────────────────────────────────
  const [isNewRuleModalOpen, setIsNewRuleModalOpen]   = useState(false);
  const [isAIReportModalOpen, setIsAIReportModalOpen] = useState(false);
  const [editingDevice, setEditingDevice]             = useState<Device | null>(null);

  // ── Load all live data from Supabase ──────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [devs, apps, logRows] = await Promise.all([
        loadDevices(),
        loadApps(),
        loadLogs(),
      ]);
      setDevices(devs);
      setAppRules(apps);
      setLogs(logRows);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Session bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        syncProfileFromSession(session.user);
        fetchAllData();
      } else {
        setIsAuthenticated(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session?.user) {
        syncProfileFromSession(session.user);
        fetchAllData();
      } else {
        // Signed out — clear sensitive state
        setDevices([]);
        setAppRules([]);
        setLogs([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllData]);

  function syncProfileFromSession(user: { email?: string; user_metadata?: Record<string, unknown> }) {
    const meta = user.user_metadata ?? {};
    setUserProfile(prev => ({
      ...prev,
      name:  (meta.full_name as string) || prev.name,
      email: user.email || prev.email,
    }));
  }

  // ── Realtime: live device status updates ──────────────────────────────────
  // When the agent sends a sync-apps call the backend stamps last_seen_at.
  // We subscribe to UPDATE events on devices so the UI reflects the change
  // instantly without polling.
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('devices_status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices' },
        (payload) => {
          const row = payload.new as {
            id: string; device_name: string;
            status: 'pending' | 'connected' | 'offline';
            last_seen_at: string | null; created_at: string;
          };
          const updated = dbDeviceToFrontend(row);
          setDevices(prev =>
            prev.some(d => d.id === updated.id)
              ? prev.map(d => d.id === updated.id ? { ...d, ...updated } : d)
              : prev   // new device inserts handled by handleDevicePaired
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated]);

  // ── Realtime: new apps appear after first sync ─────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('apps_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apps' },
        () => {
          // Re-fetch the full app list on any change — inserts come in batches
          // from sync-apps so a simple refetch is cleanest.
          loadApps().then(setAppRules).catch(console.error);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLoginSuccess = (isEmptyStateDemo = false) => {
    setIsAuthenticated(true);
    if (!isEmptyStateDemo) fetchAllData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  const handleDevicePaired = (newDevice: Device) => {
    setDevices(prev => [newDevice, ...prev]);
    setIsPairingScreenOpen(false);
    const newLog: ActivityLogEvent = {
      id:          `log-${Date.now()}`,
      title:       `Device: ${newDevice.name} connected`,
      timestamp:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateGroup:   'Today, ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      type:        'connected',
      deviceName:  newDevice.name,
      description: `Secure link established — ${newDevice.os}`,
      iconName:    'laptop_windows',
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Block/unblock an app — writes to DB, agent picks up on next Realtime event
  const handleToggleAppRule = async (appId: string) => {
    const app = appRules.find(a => a.id === appId);
    if (!app) return;

    // Optimistic UI update first
    const nextBlocked = !app.isBlocked;
    setAppRules(prev => prev.map(a =>
      a.id === appId
        ? { ...a, isBlocked: nextBlocked, status: nextBlocked ? 'Blocked' : 'Allowed' }
        : a
    ));

    try {
      await toggleAppStatus(appId, app.isBlocked);
    } catch (err) {
      // Roll back on failure
      console.error('Failed to toggle app status:', err);
      setAppRules(prev => prev.map(a =>
        a.id === appId ? { ...a, isBlocked: app.isBlocked, status: app.status } : a
      ));
    }
  };

  const handleToggleLockDevice = (deviceId: string) => {
    // Local-only for now — lock via "block all apps" could be a future DB feature
    setDevices(prev => prev.map(d => {
      if (d.id !== deviceId) return d;
      const nextLocked = !d.isLocked;
      return { ...d, isLocked: nextLocked, status: nextLocked ? 'blocked' : 'online' };
    }));
  };

  const handleToggleQuick = (toggleId: string) => {
    setQuickToggles(prev => prev.map(t => {
      if (t.id !== toggleId) return t;
      const nextState = !t.enabled;
      if (toggleId === 'tog-1') {
        setDevices(dList => dList.map(d => ({
          ...d,
          isLocked: nextState,
          status: nextState ? 'blocked' : 'online',
        })));
      }
      return { ...t, enabled: nextState };
    }));
  };

  const handleToggleActiveRule = (ruleId: string) => {
    setActiveRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handleCreateRuleConfirm = (ruleData: {
    title: string;
    type: 'forever' | 'temporary' | 'schedule';
    hours?: number;
    days?: string[];
    startTime?: string;
    endTime?: string;
  }) => {
    const newRule: AppRule = {
      id:                   `app-${Date.now()}`,
      appName:              ruleData.title,
      executableName:       `${ruleData.title.toLowerCase().replace(/\s+/g, '')}.exe`,
      category:             'Other',
      status:               ruleData.type === 'forever' ? 'Blocked' : ruleData.type === 'schedule' ? 'Scheduled' : 'Limited',
      usageTodayMinutes:    0,
      limitMinutes:         ruleData.hours ? ruleData.hours * 60 : undefined,
      iconName:             'sports_esports',
      colorClass:           'bg-purple-50 text-purple-600',
      isBlocked:            ruleData.type === 'forever',
    };
    setAppRules(prev => [newRule, ...prev]);
    setIsNewRuleModalOpen(false);
  };

  const handleUpdateDevice  = (updated: Device) => setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
  const handleRemoveDevice  = (deviceId: string) => setDevices(prev => prev.filter(d => d.id !== deviceId));
  const handleUpdateProfile = (updated: Partial<UserProfile>) => setUserProfile(prev => ({ ...prev, ...updated }));

  // ── Render guards ─────────────────────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#444651]">
          <span className="w-10 h-10 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Loading GuardianDesk…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        onOpenPairing={() => { setIsAuthenticated(true); setIsPairingScreenOpen(true); }}
      />
    );
  }

  if (isPairingScreenOpen) {
    return (
      <PairingScreen
        onClose={() => setIsPairingScreenOpen(false)}
        onDevicePaired={handleDevicePaired}
      />
    );
  }

  const visibleDevices = selectedDeviceId === 'all'
    ? devices
    : devices.filter(d => d.id === selectedDeviceId);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] font-sans flex flex-col selection:bg-[#1e3a8a] selection:text-white pb-20 md:pb-0">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        setSelectedDeviceId={setSelectedDeviceId}
        userProfile={userProfile}
        onLogout={handleLogout}
        unreadCount={logs.filter(l => l.dateGroup.startsWith('Today')).length}
      />

      <div className="flex-1 flex max-w-[1280px] w-full mx-auto">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userProfile={userProfile} />

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden min-h-[calc(100vh-64px)]">

          {/* Data loading overlay */}
          {dataLoading && (
            <div className="fixed top-20 right-6 z-50 bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-2 flex items-center gap-2 text-xs font-semibold text-[#444651]">
              <span className="w-3.5 h-3.5 border-2 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
              Syncing…
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              devices={visibleDevices}
              appRules={appRules}
              onToggleAppRule={handleToggleAppRule}
              recentLogs={logs}
              onOpenAIReport={() => setIsAIReportModalOpen(true)}
              onViewAllApps={() => setActiveTab('rules')}
            />
          )}

          {activeTab === 'devices' && (
            <DevicesView
              devices={visibleDevices}
              onOpenPairing={() => setIsPairingScreenOpen(true)}
              onToggleLockDevice={handleToggleLockDevice}
              onOpenDeviceSettings={(dev) => setEditingDevice(dev)}
            />
          )}

          {activeTab === 'rules' && (
            <RulesView
              quickToggles={quickToggles}
              onToggleQuick={handleToggleQuick}
              activeRules={activeRules}
              onToggleActiveRule={handleToggleActiveRule}
              appRules={appRules}
              onToggleAppRule={handleToggleAppRule}
              onOpenCreateRuleModal={() => setIsNewRuleModalOpen(true)}
              onOpenAIReport={() => setIsAIReportModalOpen(true)}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView
              logs={logs}
              onNewLog={(log) => setLogs(prev => [log, ...prev])}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              devices={devices}
              onRemoveDevice={handleRemoveDevice}
              onOpenPairing={() => setIsPairingScreenOpen(true)}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {isNewRuleModalOpen && (
        <NewRuleModal onClose={() => setIsNewRuleModalOpen(false)} onConfirm={handleCreateRuleConfirm} />
      )}
      {isAIReportModalOpen && (
        <AIReportModal onClose={() => setIsAIReportModalOpen(false)} devices={devices} appRules={appRules} />
      )}
      {editingDevice && (
        <DeviceSettingsModal
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSave={handleUpdateDevice}
          onRemove={handleRemoveDevice}
        />
      )}
    </div>
  );
}
