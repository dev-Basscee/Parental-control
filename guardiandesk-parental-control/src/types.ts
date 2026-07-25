export type NavTab = 'dashboard' | 'devices' | 'rules' | 'logs' | 'settings';

export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'laptop' | 'tablet' | 'phone' | 'hub' | 'console' | 'tv';
  os: string;
  status: 'online' | 'offline' | 'limiting' | 'blocked';
  screenTimeTodayMinutes: number;
  maxDailyMinutes: number;
  lastActive: string;
  ping?: string;
  isLocked?: boolean;
}

export interface AppRule {
  id: string;
  appName: string;
  executableName?: string;
  category: 'Entertainment / Games' | 'Education / Productivity' | 'Social / Messaging' | 'Gaming' | 'Entertainment' | 'Education' | 'Other';
  status: 'Blocked' | 'Allowed' | 'Scheduled' | 'Limited' | 'Unrestricted';
  usageTodayMinutes: number;
  limitMinutes?: number;
  iconName: string;
  colorClass?: string;
  isBlocked: boolean;
}

export interface ActiveRule {
  id: string;
  title: string;
  description: string;
  schedule: string;
  iconName: string;
  enabled: boolean;
  devicesCount?: number;
}

export interface ActivityLogEvent {
  id: string;
  title: string;
  timestamp: string;
  dateGroup: string; // e.g. "Today, Oct 24" or "Yesterday, Oct 23"
  type: 'blocked' | 'unblocked' | 'connected' | 'browsing' | 'warning' | 'settings';
  deviceName: string;
  description: string;
  iconName: string;
  url?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  subscriptionPlan: string;
}

export interface QuickToggle {
  id: string;
  title: string;
  description: string;
  iconName: string;
  enabled: boolean;
  colorClass?: string;
}

export interface BlockRuleFormData {
  title: string;
  type: 'forever' | 'temporary' | 'schedule';
  hours?: number;
  days?: string[];
  startTime?: string;
  endTime?: string;
}
