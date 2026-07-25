/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavTab, Device, AppRule, ActiveRule, ActivityLogEvent, UserProfile } from './types';
import { 
  initialProfile, 
  initialDevices, 
  initialAppRules, 
  initialActiveRules, 
  initialQuickToggles, 
  initialLogs 
} from './data/mockData';

import { supabase } from './lib/supabase';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AuthScreen } from './components/AuthScreen';
import { PairingScreen } from './components/PairingScreen';
import { DashboardView } from './components/DashboardView';
import { DevicesView } from './components/DevicesView';
import { RulesView } from './components/RulesView';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';

import { NewRuleModal } from './components/modals/NewRuleModal';
import { AIReportModal } from './components/modals/AIReportModal';
import { DeviceSettingsModal } from './components/modals/DeviceSettingsModal';

export default function App() {
  // Auth state — starts null (loading), then true/false once session resolves
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isPairingScreenOpen, setIsPairingScreenOpen] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');

  // Data models state
  const [userProfile, setUserProfile] = useState<UserProfile>(initialProfile);
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [appRules, setAppRules] = useState<AppRule[]>(initialAppRules);
  const [activeRules, setActiveRules] = useState<ActiveRule[]>(initialActiveRules);
  const [quickToggles, setQuickToggles] = useState(initialQuickToggles);
  const [logs, setLogs] = useState<ActivityLogEvent[]>(initialLogs);

  // Modals state
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState<boolean>(false);
  const [isAIReportModalOpen, setIsAIReportModalOpen] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // ── Session bootstrap ──────────────────────────────────────────────────────
  // On mount, check for an existing Supabase session so the parent doesn't have
  // to log in again after a page refresh.  Supabase persists sessions in
  // localStorage by default.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        // Populate profile from session metadata if available
        const meta = session.user.user_metadata;
        if (meta?.full_name || session.user.email) {
          setUserProfile(prev => ({
            ...prev,
            name:  meta?.full_name || prev.name,
            email: session.user!.email || prev.email,
          }));
        }
      } else {
        setIsAuthenticated(false);
      }
    });

    // Listen for sign-in / sign-out events (e.g. token refresh, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session?.user) {
        const meta = session.user.user_metadata;
        if (meta?.full_name || session.user.email) {
          setUserProfile(prev => ({
            ...prev,
            name:  meta?.full_name || prev.name,
            email: session.user!.email || prev.email,
          }));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLoginSuccess = (isEmptyStateDemo = false) => {
    setIsAuthenticated(true);
    if (isEmptyStateDemo) {
      setDevices([]);
      setAppRules([]);
    } else {
      setDevices(initialDevices);
      setAppRules(initialAppRules);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  const handleDevicePaired = (newDevice: Device) => {
    setDevices(prev => [newDevice, ...prev]);
    setIsPairingScreenOpen(false);
    
    // Log activity
    const newLog: ActivityLogEvent = {
      id: `log-${Date.now()}`,
      title: `Device: ${newDevice.name} connected`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateGroup: "Today, Oct 24",
      type: 'connected',
      deviceName: newDevice.name,
      description: `Secure link established — ${newDevice.os}`,
      iconName: 'laptop_windows'
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleToggleAppRule = (appId: string) => {
    setAppRules(prev => prev.map(app => {
      if (app.id === appId) {
        const nextIsBlocked = !app.isBlocked;
        const nextStatus = nextIsBlocked ? 'Blocked' : 'Allowed';
        
        // Add log
        const newLog: ActivityLogEvent = {
          id: `log-${Date.now()}`,
          title: `${app.appName} ${nextIsBlocked ? 'blocked' : 'unblocked'} by parent`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateGroup: "Today, Oct 24",
          type: nextIsBlocked ? 'blocked' : 'unblocked',
          deviceName: "Leo's Gaming PC",
          description: `Manual intervention applied from GuardianDesk`,
          iconName: nextIsBlocked ? 'block' : 'auto_awesome'
        };
        setLogs(l => [newLog, ...l]);

        return {
          ...app,
          isBlocked: nextIsBlocked,
          status: nextStatus
        };
      }
      return app;
    }));
  };

  const handleToggleLockDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === deviceId) {
        const nextLocked = !d.isLocked;
        
        const newLog: ActivityLogEvent = {
          id: `log-${Date.now()}`,
          title: `Device ${d.name} ${nextLocked ? 'LOCKED' : 'UNLOCKED'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateGroup: "Today, Oct 24",
          type: nextLocked ? 'blocked' : 'unblocked',
          deviceName: d.name,
          description: `Instant Guardian lock ${nextLocked ? 'enforced' : 'released'}`,
          iconName: nextLocked ? 'bedtime' : 'laptop_windows'
        };
        setLogs(l => [newLog, ...l]);

        return {
          ...d,
          isLocked: nextLocked,
          status: nextLocked ? 'blocked' : 'online'
        };
      }
      return d;
    }));
  };

  const handleToggleQuick = (toggleId: string) => {
    setQuickToggles(prev => prev.map(t => {
      if (t.id === toggleId) {
        const nextState = !t.enabled;
        if (toggleId === 'tog-1' && nextState) {
          // Pause internet enabled
          setDevices(dList => dList.map(d => ({ ...d, isLocked: true, status: 'blocked' })));
        } else if (toggleId === 'tog-1' && !nextState) {
          setDevices(dList => dList.map(d => ({ ...d, isLocked: false, status: 'online' })));
        }
        return { ...t, enabled: nextState };
      }
      return t;
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
      id: `app-${Date.now()}`,
      appName: ruleData.title,
      executableName: `${ruleData.title.toLowerCase().replace(/\s+/g, '')}.exe`,
      category: "Other",
      status: ruleData.type === 'forever' ? 'Blocked' : ruleData.type === 'schedule' ? 'Scheduled' : 'Limited',
      usageTodayMinutes: 0,
      limitMinutes: ruleData.hours ? ruleData.hours * 60 : undefined,
      iconName: 'sports_esports',
      colorClass: "bg-purple-50 text-purple-600",
      isBlocked: ruleData.type === 'forever'
    };
    setAppRules(prev => [newRule, ...prev]);
    setIsNewRuleModalOpen(false);

    const newLog: ActivityLogEvent = {
      id: `log-${Date.now()}`,
      title: `New rule created: ${ruleData.title}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateGroup: "Today, Oct 24",
      type: 'blocked',
      deviceName: "All Devices",
      description: `Rule type: ${ruleData.type.toUpperCase()}`,
      iconName: 'gavel'
    };
    setLogs(l => [newLog, ...l]);
  };

  const handleUpdateDevice = (updated: Device) => {
    setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const handleRemoveDevice = (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...updated }));
  };

  // ── Loading splash while session resolves ──────────────────────────────────
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

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        onOpenPairing={() => {
          setIsAuthenticated(true);
          setIsPairingScreenOpen(true);
        }}
      />
    );
  }

  // ── Device Pairing screen ──────────────────────────────────────────────────
  if (isPairingScreenOpen) {
    return (
      <PairingScreen
        onClose={() => setIsPairingScreenOpen(false)}
        onDevicePaired={handleDevicePaired}
      />
    );
  }

  // Filter devices if device switcher is not 'all'
  const visibleDevices = selectedDeviceId === 'all' 
    ? devices 
    : devices.filter(d => d.id === selectedDeviceId);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] font-sans flex flex-col selection:bg-[#1e3a8a] selection:text-white pb-20 md:pb-0">
      {/* Sticky Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        setSelectedDeviceId={setSelectedDeviceId}
        userProfile={userProfile}
        onLogout={handleLogout}
        unreadCount={logs.filter(l => l.dateGroup === 'Today, Oct 24').length}
      />

      {/* Main Body Layout with Fixed Desktop Sidebar */}
      <div className="flex-1 flex max-w-[1280px] w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
        />

        {/* Dynamic Tab Content View */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden min-h-[calc(100vh-64px)]">
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

      {/* Modals */}
      {isNewRuleModalOpen && (
        <NewRuleModal
          onClose={() => setIsNewRuleModalOpen(false)}
          onConfirm={handleCreateRuleConfirm}
        />
      )}

      {isAIReportModalOpen && (
        <AIReportModal
          onClose={() => setIsAIReportModalOpen(false)}
          devices={devices}
          appRules={appRules}
        />
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
