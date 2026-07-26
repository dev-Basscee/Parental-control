/**
 * lib/db.ts
 *
 * All Supabase query helpers used by the parent dashboard.
 * Every function here works within the parent's RLS session — they only
 * return rows that belong to the currently signed-in parent (auth.uid()).
 */

import { supabase } from './supabase';
import type { Device, AppRule, ActivityLogEvent } from '../types';

// ── Types that mirror the DB rows ─────────────────────────────────────────────

interface DbDevice {
  id: string;
  device_name: string;
  status: 'pending' | 'connected' | 'offline';
  last_seen_at: string | null;
  created_at: string;
}

interface DbApp {
  id: string;
  device_id: string;
  app_name: string;
  display_name: string;
  status: 'allowed' | 'blocked' | 'scheduled';
  last_updated: string;
}

interface DbLog {
  id: string;
  device_id: string;
  app_name: string;
  action: string;
  triggered_by: string;
  created_at: string;
  // joined (Supabase returns a one-element array for FK joins):
  devices?: { device_name: string }[] | null;
}

// ── Devices ───────────────────────────────────────────────────────────────────

/** Load all devices that belong to the signed-in parent. */
export async function loadDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('id, device_name, status, last_seen_at, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as DbDevice[]).map(dbDeviceToFrontend);
}

/** Map a DB device row to the frontend Device type. */
export function dbDeviceToFrontend(row: DbDevice): Device {
  const nowMs   = Date.now();
  const seenMs  = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const gapSecs = (nowMs - seenMs) / 1000;

  // Treat as online if seen within the last 90 seconds (agent syncs every 60 s)
  const isOnline = row.status === 'connected' && gapSecs < 90;

  return {
    id:                     row.id,
    name:                   row.device_name,
    type:                   'laptop',           // agent is always a Windows PC
    os:                     'Windows PC',
    status:                 isOnline ? 'online' : row.status === 'connected' ? 'offline' : row.status === 'pending' ? 'offline' : 'offline',
    screenTimeTodayMinutes: 0,                  // not tracked server-side yet
    maxDailyMinutes:        240,
    lastActive:             row.last_seen_at
                              ? formatRelative(new Date(row.last_seen_at))
                              : 'Never',
    ping:                   isOnline ? '—' : undefined,
  };
}

function formatRelative(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return 'Active now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString();
}

// ── Apps ──────────────────────────────────────────────────────────────────────

/** Load all apps across all of the parent's devices. */
export async function loadApps(): Promise<AppRule[]> {
  const { data, error } = await supabase
    .from('apps')
    .select('id, device_id, app_name, display_name, status, last_updated')
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return (data as DbApp[]).map(dbAppToFrontend);
}

/** Map a DB app row to the frontend AppRule type. */
export function dbAppToFrontend(row: DbApp): AppRule {
  const isBlocked = row.status === 'blocked';
  return {
    id:                   row.id,
    appName:              row.display_name || row.app_name,
    executableName:       row.app_name,
    category:             'Other',
    status:               isBlocked ? 'Blocked' : row.status === 'scheduled' ? 'Scheduled' : 'Allowed',
    usageTodayMinutes:    0,
    iconName:             guessIcon(row.app_name),
    colorClass:           isBlocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
    isBlocked,
  };
}

function guessIcon(appName: string): string {
  const n = appName.toLowerCase();
  if (n.includes('roblox') || n.includes('steam') || n.includes('game')) return 'sports_esports';
  if (n.includes('discord') || n.includes('slack') || n.includes('teams')) return 'forum';
  if (n.includes('netflix') || n.includes('youtube') || n.includes('vlc'))  return 'movie';
  if (n.includes('code') || n.includes('vscode') || n.includes('python'))   return 'code';
  if (n.includes('tiktok') || n.includes('twitter') || n.includes('insta')) return 'share';
  if (n.includes('khan') || n.includes('school') || n.includes('edu'))      return 'school';
  return 'sports_esports';
}

// ── Toggle app block status ───────────────────────────────────────────────────

/**
 * Flip an app between 'blocked' and 'allowed' in the database.
 * The agent picks this up on its next sync-apps call (≤ 60 s) or immediately
 * via the Realtime subscription on the apps table.
 */
export async function toggleAppStatus(appId: string, currentlyBlocked: boolean): Promise<void> {
  const newStatus = currentlyBlocked ? 'allowed' : 'blocked';
  const { error } = await supabase
    .from('apps')
    .update({ status: newStatus, last_updated: new Date().toISOString() })
    .eq('id', appId);
  if (error) throw error;
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

/** Load the 100 most recent activity log rows for this parent's devices. */
export async function loadLogs(): Promise<ActivityLogEvent[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, device_id, app_name, action, triggered_by, created_at, devices(device_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as unknown as DbLog[]).map(dbLogToFrontend);
}

/** Map a DB activity_log row to the frontend ActivityLogEvent type. */
export function dbLogToFrontend(row: DbLog): ActivityLogEvent {
  const d = new Date(row.created_at);
  return {
    id:          row.id,
    title:       formatLogTitle(row.action, row.app_name),
    timestamp:   d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateGroup:   formatDateGroup(d),
    type:        mapAction(row.action),
    deviceName:  row.devices?.[0]?.device_name ?? row.device_id,
    description: `${row.app_name} • ${row.triggered_by}`,
    iconName:    guessIcon(row.app_name),
  };
}

function formatLogTitle(action: string, appName: string): string {
  switch (action) {
    case 'blocked':                   return `${appName} blocked`;
    case 'unblocked':                 return `${appName} unblocked`;
    case 'agent_started':
    case 'agent_restarted':
    case 'agent_restarted_after_gap': return `Device agent started`;
    default:                          return action.replace(/_/g, ' ');
  }
}

function mapAction(action: string): ActivityLogEvent['type'] {
  if (action === 'blocked')                   return 'blocked';
  if (action === 'unblocked')                 return 'unblocked';
  if (action.includes('start') || action.includes('connect') || action.includes('restart')) return 'connected';
  return 'settings';
}

function formatDateGroup(d: Date): string {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const target    = new Date(d);    target.setHours(0,0,0,0);

  if (target.getTime() === today.getTime())
    return 'Today, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (target.getTime() === yesterday.getTime())
    return 'Yesterday, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
