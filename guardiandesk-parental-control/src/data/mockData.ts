import { Device, AppRule, ActiveRule, ActivityLogEvent, UserProfile, QuickToggle } from '../types';

export const initialProfile: UserProfile = {
  name: "Parent Account",
  email: "parent.admin@email.com",
  role: "Guardian Mode Active",
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDhFEnEofXse5ZmZjQWrCe9p7jSlqxe3zTVJ93KNpSZYPcy0vdW1-CnQdYz57sSqav60rwu1BUUwCoNURN6WSlFohngWMvFxUmGT4Dl9mUqH0yehKx9EftcXUynwz5wdnxCKM7AGax8j341Fp6qRGp8i64pK26KUgFKn9dx_a_4Ht_z2WvpjB-mE-tkVCdWPmBM11sDIcZ8u9mJs65tf1L6vQv0pdNDFp5IOL8tUt1ELdNrGuII1Z3m_tBdGsYtl3XlnkPFk2WUi7UR",
  subscriptionPlan: "Guardian Pro Monthly"
};

export const initialDevices: Device[] = [
  {
    id: "dev-1",
    name: "Leo's Gaming PC",
    type: "desktop",
    os: "Alienware Aurora R15 • Windows 11",
    status: "online",
    screenTimeTodayMinutes: 252, // 4h 12m
    maxDailyMinutes: 300,
    lastActive: "Active now",
    ping: "24ms"
  },
  {
    id: "dev-2",
    name: "Maya's Tablet",
    type: "tablet",
    os: "iPad Pro 11\" • iPadOS 18",
    status: "offline",
    screenTimeTodayMinutes: 105, // 1h 45m
    maxDailyMinutes: 180,
    lastActive: "Last active 15m ago"
  },
  {
    id: "dev-3",
    name: "Kitchen Hub",
    type: "hub",
    os: "Google Nest Hub",
    status: "online",
    screenTimeTodayMinutes: 15, // 0h 15m
    maxDailyMinutes: 120,
    lastActive: "Active now",
    ping: "12ms"
  },
  {
    id: "dev-4",
    name: "Leo's Phone",
    type: "phone",
    os: "iPhone 14 Pro • iOS 18",
    status: "limiting",
    screenTimeTodayMinutes: 350, // 5h 50m
    maxDailyMinutes: 360,
    lastActive: "Active now",
    ping: "38ms",
    isLocked: false
  },
  {
    id: "dev-5",
    name: "Study Room Desktop",
    type: "desktop",
    os: "Windows 10 • Offline",
    status: "offline",
    screenTimeTodayMinutes: 45,
    maxDailyMinutes: 240,
    lastActive: "Last active yesterday"
  }
];

export const initialAppRules: AppRule[] = [
  {
    id: "app-1",
    appName: "Roblox",
    executableName: "Roblox.exe",
    category: "Entertainment / Games",
    status: "Blocked",
    usageTodayMinutes: 72, // 1h 12m
    limitMinutes: 60,
    iconName: "sports_esports",
    colorClass: "bg-red-50 text-red-600",
    isBlocked: true
  },
  {
    id: "app-2",
    appName: "VSCode",
    executableName: "VSCode.exe",
    category: "Education / Productivity",
    status: "Allowed",
    usageTodayMinutes: 165, // 2h 45m
    limitMinutes: 300,
    iconName: "code",
    colorClass: "bg-emerald-50 text-emerald-600",
    isBlocked: false
  },
  {
    id: "app-3",
    appName: "Discord",
    executableName: "Discord.exe",
    category: "Social / Messaging",
    status: "Scheduled",
    usageTodayMinutes: 18, // 18m
    limitMinutes: 60,
    iconName: "forum",
    colorClass: "bg-indigo-50 text-indigo-600",
    isBlocked: false
  },
  {
    id: "app-4",
    appName: "Netflix",
    executableName: "Netflix.exe",
    category: "Entertainment",
    status: "Blocked",
    usageTodayMinutes: 0,
    limitMinutes: 0,
    iconName: "movie",
    colorClass: "bg-rose-50 text-rose-600",
    isBlocked: true
  },
  {
    id: "app-5",
    appName: "Khan Academy",
    executableName: "Safari / Web",
    category: "Education",
    status: "Unrestricted",
    usageTodayMinutes: 90,
    limitMinutes: undefined,
    iconName: "school",
    colorClass: "bg-blue-50 text-blue-600",
    isBlocked: false
  },
  {
    id: "app-6",
    appName: "TikTok",
    executableName: "TikTok App",
    category: "Social / Messaging",
    status: "Blocked",
    usageTodayMinutes: 0,
    limitMinutes: 30,
    iconName: "share",
    colorClass: "bg-purple-50 text-purple-600",
    isBlocked: true
  }
];

export const initialActiveRules: ActiveRule[] = [
  {
    id: "rule-1",
    title: "Bedtime Mode",
    description: "All devices disabled at 9:00 PM",
    schedule: "Daily",
    iconName: "bedtime",
    enabled: true
  },
  {
    id: "rule-2",
    title: "Homework Window",
    description: "Education only apps (4pm - 6pm)",
    schedule: "Mon - Fri",
    iconName: "menu_book",
    enabled: true
  },
  {
    id: "rule-3",
    title: "Social Media Limit",
    description: "Max 1 hour combined daily",
    schedule: "3 Devices",
    iconName: "timer",
    enabled: true,
    devicesCount: 3
  }
];

export const initialQuickToggles: QuickToggle[] = [
  {
    id: "tog-1",
    title: "Pause Internet",
    description: "Block all outgoing traffic",
    iconName: "block",
    enabled: false,
    colorClass: "text-error"
  },
  {
    id: "tog-2",
    title: "Safe Search",
    description: "Enforce filter on search engines",
    iconName: "search_check",
    enabled: true,
    colorClass: "text-primary"
  },
  {
    id: "tog-3",
    title: "Ad Blocker",
    description: "System-wide network filtering",
    iconName: "security_update_good",
    enabled: true,
    colorClass: "text-secondary"
  }
];

export const initialLogs: ActivityLogEvent[] = [
  {
    id: "log-1",
    title: "Roblox.exe blocked by parent",
    timestamp: "2:30 PM",
    dateGroup: "Today, Oct 24",
    type: "blocked",
    deviceName: "Child-PC",
    description: "Manual intervention on Child-PC",
    iconName: "block"
  },
  {
    id: "log-2",
    title: "VSCode.exe unblocked",
    timestamp: "1:00 PM",
    dateGroup: "Today, Oct 24",
    type: "unblocked",
    deviceName: "Child-PC",
    description: "Automatic (schedule ended) — Homework window active",
    iconName: "auto_awesome"
  },
  {
    id: "log-3",
    title: "Device: Child-PC connected",
    timestamp: "9:00 AM",
    dateGroup: "Today, Oct 24",
    type: "connected",
    deviceName: "Child-PC",
    description: "System startup detected — Home Network (Ethernet)",
    iconName: "laptop_windows"
  },
  {
    id: "log-4",
    title: "Extensive browsing session",
    timestamp: "8:15 PM",
    dateGroup: "Yesterday, Oct 23",
    type: "browsing",
    deviceName: "Child-Tablet",
    description: "24 educational websites visited on Child-Tablet",
    iconName: "search"
  },
  {
    id: "log-5",
    title: "Discord access restricted",
    timestamp: "11:15 PM",
    dateGroup: "Yesterday, Oct 23",
    type: "blocked",
    deviceName: "Leo's Phone",
    description: "Bedtime Mode rule enforced automatically",
    iconName: "bedtime"
  },
  {
    id: "log-6",
    title: "Safari history logged: khanacademy.org",
    timestamp: "4:30 PM",
    dateGroup: "Yesterday, Oct 23",
    type: "browsing",
    deviceName: "Leo's MacBook Pro",
    description: "45 minutes spent on Math & Science modules",
    iconName: "school"
  }
];
