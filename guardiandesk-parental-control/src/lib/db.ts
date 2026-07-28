/**
 * lib/db.ts
 *
 * All Supabase query helpers used by the parent dashboard.
 * Every function here works within the parent's RLS session — they only
 * return rows that belong to the currently signed-in parent (auth.uid()).
 */

import { supabase } from './supabase';
import type { Device, AppRule, ActiveRule, ActivityLogEvent } from '../types';

// ── Types that mirror the DB rows ─────────────────────────────────────────────

interface DbDevice {
  id: string;
  device_name: string;
  status: 'pending' | 'connected' | 'offline';
  last_seen_at: string | null;
  created_at: string;
  is_locked?: boolean;
}

interface DbApp {
  id: string;
  device_id: string;
  app_name: string;
  display_name: string;
  status: 'allowed' | 'blocked' | 'scheduled';
  last_updated: string;
  devices?: { device_name: string }[] | null;
}

interface DbLog {
  id: string;
  device_id: string;
  app_name: string;
  action: string;
  triggered_by: string;
  created_at: string;
  devices?: { device_name: string }[] | null;
}

interface DbRule {
  id: string;
  app_id: string;
  rule_type: 'timed' | 'scheduled';
  duration_minutes: number | null;
  schedule_days: string[] | null;
  schedule_start: string | null;
  schedule_end: string | null;
  expires_at: string | null;
  apps?: { app_name: string; display_name: string; device_id: string }[] | null;
}

// ── Devices ───────────────────────────────────────────────────────────────────

/** Load all devices that belong to the signed-in parent. */
export async function loadDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('id, device_name, status, last_seen_at, created_at, is_locked')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as DbDevice[]).map(dbDeviceToFrontend);
}

/** Map a DB device row to the frontend Device type. */
export function dbDeviceToFrontend(row: DbDevice): Device {
  const nowMs   = Date.now();
  const seenMs  = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const gapSecs = (nowMs - seenMs) / 1000;

  const isOnline = row.status === 'connected' && gapSecs < 90;

  return {
    id:                     row.id,
    name:                   row.device_name,
    type:                   'laptop',
    os:                     'Windows PC',
    status:                 row.is_locked
                              ? 'blocked'
                              : isOnline ? 'online' : 'offline',
    screenTimeTodayMinutes: 0,
    maxDailyMinutes:        240,
    lastActive:             row.last_seen_at
                              ? formatRelative(new Date(row.last_seen_at))
                              : 'Never',
    ping:                   isOnline ? '—' : undefined,
    isLocked:               row.is_locked ?? false,
  };
}

function formatRelative(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)    return 'Active now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString();
}

/** Delete a device and all its associated data (cascades via FK). */
export async function removeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', deviceId);
  if (error) throw error;
}

/** Rename a device. */
export async function updateDeviceSettings(
  deviceId: string,
  patch: { device_name?: string },
): Promise<void> {
  const { error } = await supabase.from('devices').update(patch).eq('id', deviceId);
  if (error) throw error;
}

/** Lock or unlock a device. Agent picks up is_locked via Realtime. */
export async function setDeviceLocked(deviceId: string, locked: boolean): Promise<void> {
  const { error } = await supabase
    .from('devices')
    .update({ is_locked: locked })
    .eq('id', deviceId);
  if (error) throw error;
}

// ── Apps ──────────────────────────────────────────────────────────────────────

/** Load all apps across all of the parent's devices. */
export async function loadApps(): Promise<AppRule[]> {
  const { data, error } = await supabase
    .from('apps')
    .select('id, device_id, app_name, display_name, status, last_updated, devices(device_name)')
    .order('last_updated', { ascending: false });

  if (error) throw error;
  return (data as unknown as DbApp[]).map(dbAppToFrontend);
}

/** Map a DB app row to the frontend AppRule type. */
export function dbAppToFrontend(row: DbApp): AppRule {
  const isBlocked  = row.status === 'blocked';
  const deviceName = row.devices?.[0]?.device_name;
  return {
    id:                   row.id,
    appName:              row.display_name || row.app_name,
    executableName:       row.app_name,
    category:             deviceName ? (deviceName as AppRule['category']) : 'Other',
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

/** Flip an app between 'blocked' and 'allowed' in the database. */
export async function toggleAppStatus(appId: string, currentlyBlocked: boolean): Promise<void> {
  const newStatus = currentlyBlocked ? 'allowed' : 'blocked';
  const { error } = await supabase
    .from('apps')
    .update({ status: newStatus, last_updated: new Date().toISOString() })
    .eq('id', appId);
  if (error) throw error;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  deviceId:       string;
  appName:        string;
  displayName:    string;
  type:           'forever' | 'temporary' | 'schedule';
  durationHours?: number;
  scheduleDays?:  string[];
  scheduleStart?: string;
  scheduleEnd?:   string;
}

/**
 * Upsert an app row and its rule:
 *   'forever'   → apps.status = 'blocked', no rules row
 *   'temporary' → apps.status = 'blocked',   rules row with rule_type='timed'
 *   'schedule'  → apps.status = 'scheduled', rules row with rule_type='scheduled'
 */
export async function createRule(input: CreateRuleInput): Promise<string> {
  const appStatus = input.type === 'schedule' ? 'scheduled' : 'blocked';

  const { data: appRow, error: appError } = await supabase
    .from('apps')
    .upsert(
      {
        device_id:    input.deviceId,
        app_name:     input.appName,
        display_name: input.displayName,
        status:       appStatus,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'device_id,app_name' },
    )
    .select('id')
    .single();

  if (appError) throw appError;
  const appId = appRow.id as string;

  // Clear any existing rule for this app before inserting the new one
  await supabase.from('rules').delete().eq('app_id', appId);

  if (input.type === 'temporary') {
    if (!input.durationHours) throw new Error('durationHours is required for temporary rules');
    const expiresAt = new Date(Date.now() + input.durationHours * 3_600_000).toISOString();
    const { error: ruleError } = await supabase.from('rules').insert({
      app_id:           appId,
      rule_type:        'timed',
      duration_minutes: input.durationHours * 60,
      expires_at:       expiresAt,
    });
    if (ruleError) throw ruleError;
  }

  if (input.type === 'schedule') {
    if (!input.scheduleDays?.length || !input.scheduleStart || !input.scheduleEnd) {
      throw new Error('scheduleDays, scheduleStart, scheduleEnd are required for scheduled rules');
    }
    const { error: ruleError } = await supabase.from('rules').insert({
      app_id:         appId,
      rule_type:      'scheduled',
      schedule_days:  input.scheduleDays,
      schedule_start: input.scheduleStart,
      schedule_end:   input.scheduleEnd,
    });
    if (ruleError) throw ruleError;
  }

  return appId;
}

/** Load all active rules (timed + scheduled) for this parent's devices. */
export async function loadActiveRules(): Promise<ActiveRule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select(`
      id, app_id, rule_type, duration_minutes,
      schedule_days, schedule_start, schedule_end, expires_at,
      apps ( app_name, display_name, device_id )
    `);

  if (error) throw error;

  return (data as unknown as DbRule[]).map((row) => {
    const app = row.apps?.[0];
    const summary =
      row.rule_type === 'timed'
        ? `Blocked for ${row.duration_minutes} min`
        : `${(row.schedule_days ?? []).join(', ')} ${row.schedule_start}–${row.schedule_end}`;

    return {
      id:          row.id,
      title:       app?.display_name ?? app?.app_name ?? 'Unknown app',
      description: summary,
      schedule:    row.rule_type === 'timed' ? 'Temporary' : 'Scheduled',
      iconName:    guessIcon(app?.app_name ?? ''),
      enabled:     true,
    };
  });
}

/**
 * Delete a rule and set the app back to 'allowed'.
 * Mirrors what expire-timed-rules does server-side.
 */
export async function deleteRuleAndUnblock(ruleId: string): Promise<void> {
  const { data: rule, error: fetchErr } = await supabase
    .from('rules').select('app_id').eq('id', ruleId).single();
  if (fetchErr) throw fetchErr;

  const { error: delErr } = await supabase.from('rules').delete().eq('id', ruleId);
  if (delErr) throw delErr;

  const { error: appErr } = await supabase
    .from('apps')
    .update({ status: 'allowed', last_updated: new Date().toISOString() })
    .eq('id', rule.app_id);
  if (appErr) throw appErr;
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
  if (action === 'blocked')   return 'blocked';
  if (action === 'unblocked') return 'unblocked';
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
