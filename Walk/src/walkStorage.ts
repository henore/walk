import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  SESSIONS: 'walk_sessions',
  ACTIVE_SESSION: 'walk_active_session',
  DAILY_GOAL: 'walk_daily_goal',
  GOAL_NOTIF: 'walk_goal_notif',
  REMINDER_ENABLED: 'walk_reminder_enabled',
  REMINDER_TIME: 'walk_reminder_time',
  CUSTOM_PURPOSES: 'walk_custom_purposes',
  THEME: 'walk_theme',
  CURRENT_STREAK: 'walk_current_streak',
  LONGEST_STREAK: 'walk_longest_streak',
  LAST_COMPLETED_DATE: 'walk_last_completed_date',
  GOAL_NOTIFIED_DATE: 'walk_goal_notified_date',
  IS_PRO: 'walk_is_pro',
  FIRST_LAUNCH: 'walk_first_launch',
} as const;

export type WalkSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pausedSeconds?: number;
  purpose: string;
  note: string | null;
};

export type ActiveSession = {
  startedAt: number;
  purpose: string;
  isPaused: boolean;
  pausedAt: number;
  totalPausedDuration: number;
};

export type ThemeMode = 'light' | 'dark' | 'system';

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
};

export const DEFAULT_PURPOSES = ['music', 'explore', 'shopping', 'errand', 'think', 'other'];

export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Sessions ──

export async function getSessions(): Promise<WalkSession[]> {
  const val = await AsyncStorage.getItem(K.SESSIONS);
  return val ? JSON.parse(val) : [];
}

export async function addSession(session: WalkSession): Promise<void> {
  const sessions = await getSessions();
  sessions.unshift(session);
  if (sessions.length > 500) sessions.length = 500;
  await AsyncStorage.setItem(K.SESSIONS, JSON.stringify(sessions));
}

export async function deleteSession(id: string): Promise<WalkSession[]> {
  const sessions = await getSessions();
  const filtered = sessions.filter(s => s.id !== id);
  await AsyncStorage.setItem(K.SESSIONS, JSON.stringify(filtered));
  return filtered;
}

export async function updateSession(id: string, updates: Partial<Pick<WalkSession, 'startedAt' | 'endedAt' | 'purpose'>>): Promise<WalkSession[]> {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx >= 0) {
    sessions[idx] = {...sessions[idx], ...updates};
    await AsyncStorage.setItem(K.SESSIONS, JSON.stringify(sessions));
  }
  return sessions;
}

// ── Active Session ──

export async function getActiveSession(): Promise<ActiveSession | null> {
  const val = await AsyncStorage.getItem(K.ACTIVE_SESSION);
  return val ? JSON.parse(val) : null;
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  await AsyncStorage.setItem(K.ACTIVE_SESSION, JSON.stringify(session));
}

export async function clearActiveSession(): Promise<void> {
  await AsyncStorage.removeItem(K.ACTIVE_SESSION);
}

// ── Daily Goal ──

export async function getDailyGoalMinutes(): Promise<number> {
  const val = await AsyncStorage.getItem(K.DAILY_GOAL);
  return val ? Number(val) : 20;
}

export async function setDailyGoalMinutes(minutes: number): Promise<void> {
  await AsyncStorage.setItem(K.DAILY_GOAL, String(minutes));
}

// ── Goal Notification ──

export async function getGoalNotifEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(K.GOAL_NOTIF);
  return val !== 'false';
}

export async function setGoalNotifEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(K.GOAL_NOTIF, String(enabled));
}

export async function getGoalNotifiedDate(): Promise<string> {
  return (await AsyncStorage.getItem(K.GOAL_NOTIFIED_DATE)) || '';
}

export async function setGoalNotifiedDate(dateKey: string): Promise<void> {
  await AsyncStorage.setItem(K.GOAL_NOTIFIED_DATE, dateKey);
}

// ── Daily Reminder ──

export async function getReminderEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(K.REMINDER_ENABLED);
  return val === 'true';
}

export async function setReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(K.REMINDER_ENABLED, String(enabled));
}

export async function getReminderTime(): Promise<string> {
  return (await AsyncStorage.getItem(K.REMINDER_TIME)) || '20:00';
}

export async function setReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(K.REMINDER_TIME, time);
}

// ── Custom Purposes ──

export async function getCustomPurposes(): Promise<string[]> {
  const val = await AsyncStorage.getItem(K.CUSTOM_PURPOSES);
  return val ? JSON.parse(val) : [];
}

export async function setCustomPurposes(purposes: string[]): Promise<void> {
  await AsyncStorage.setItem(K.CUSTOM_PURPOSES, JSON.stringify(purposes));
}

// ── Theme ──

export async function getThemeMode(): Promise<ThemeMode> {
  const val = await AsyncStorage.getItem(K.THEME);
  return (val as ThemeMode) || 'light';
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(K.THEME, mode);
}

// ── Streak ──

export async function getStreakData(): Promise<StreakData> {
  const [current, longest, lastDate] = await Promise.all([
    AsyncStorage.getItem(K.CURRENT_STREAK),
    AsyncStorage.getItem(K.LONGEST_STREAK),
    AsyncStorage.getItem(K.LAST_COMPLETED_DATE),
  ]);
  return {
    currentStreak: current ? Number(current) : 0,
    longestStreak: longest ? Number(longest) : 0,
    lastCompletedDate: lastDate || '',
  };
}

export async function updateStreak(): Promise<StreakData> {
  const today = toLocalDateKey(new Date());
  const data = await getStreakData();
  if (data.lastCompletedDate === today) return data;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const newCurrent = data.lastCompletedDate === yesterdayKey ? data.currentStreak + 1 : 1;
  const newLongest = Math.max(data.longestStreak, newCurrent);

  await Promise.all([
    AsyncStorage.setItem(K.CURRENT_STREAK, String(newCurrent)),
    AsyncStorage.setItem(K.LONGEST_STREAK, String(newLongest)),
    AsyncStorage.setItem(K.LAST_COMPLETED_DATE, today),
  ]);

  return {currentStreak: newCurrent, longestStreak: newLongest, lastCompletedDate: today};
}

export function getLiveStreak(data: StreakData): number {
  if (!data.lastCompletedDate) return 0;
  const today = toLocalDateKey(new Date());
  if (data.lastCompletedDate === today) return data.currentStreak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (data.lastCompletedDate === toLocalDateKey(yesterday)) return data.currentStreak;
  return 0;
}

// ── Today helpers ──

export function getTodayWalkSeconds(sessions: WalkSession[]): number {
  const today = toLocalDateKey(new Date());
  let total = 0;
  for (const s of sessions) {
    const endDate = new Date(s.endedAt);
    if (toLocalDateKey(endDate) === today) {
      total += s.durationSeconds;
    }
  }
  return total;
}

export function getElapsedSeconds(active: ActiveSession): number {
  if (active.isPaused) {
    const beforePause = active.pausedAt - active.startedAt - active.totalPausedDuration;
    return Math.max(0, Math.floor(beforePause / 1000));
  }
  const now = Date.now();
  const elapsed = now - active.startedAt - active.totalPausedDuration;
  return Math.max(0, Math.floor(elapsed / 1000));
}

// ── Pro Status ──

export async function getProStatus(): Promise<boolean> {
  const val = await AsyncStorage.getItem(K.IS_PRO);
  return val === 'true';
}

export async function setProStatus(isPro: boolean): Promise<void> {
  await AsyncStorage.setItem(K.IS_PRO, String(isPro));
}

// ── Trial ──

const TRIAL_DURATION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days

export type TrialInfo = {
  active: boolean;
  remainingMs: number;
  firstLaunch: number;
};

export async function initFirstLaunchDate(): Promise<number> {
  const val = await AsyncStorage.getItem(K.FIRST_LAUNCH);
  if (val) return Number(val);
  const now = Date.now();
  await AsyncStorage.setItem(K.FIRST_LAUNCH, String(now));
  return now;
}

export async function getFirstLaunchDate(): Promise<number> {
  const val = await AsyncStorage.getItem(K.FIRST_LAUNCH);
  return val ? Number(val) : 0;
}

export function computeTrialInfo(firstLaunch: number): TrialInfo {
  if (!firstLaunch) return {active: false, remainingMs: 0, firstLaunch: 0};
  const elapsed = Date.now() - firstLaunch;
  const remaining = TRIAL_DURATION_MS - elapsed;
  return {
    active: remaining > 0,
    remainingMs: Math.max(0, remaining),
    firstLaunch,
  };
}

export function formatTrialRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return '';
  const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.max(1, Math.ceil(remainingMs / (1000 * 60)));
  return `${mins}m`;
}

// ── Stats Aggregation ──

export type PeriodStats = {
  totalWalks: number;
  totalMinutes: number;
  goalDays: number;
  avgWalkMinutes: number;
  currentStreak: number;
  longestStreak: number;
};

export type PurposeStat = {
  purpose: string;
  walks: number;
  totalMinutes: number;
};

export type DetailedStats = {
  avgWalksPerActiveDay: number;
  avgWalkDuration: number;
  bestDayDate: string;
  bestDayMinutes: number;
  mostUsedPurpose: string;
};

export function filterSessionsByPeriod(
  sessions: WalkSession[],
  period: '7d' | '30d' | '90d' | 'all',
): WalkSession[] {
  if (period === 'all') return sessions;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return sessions.filter(s => new Date(s.endedAt) >= cutoff);
}

export function computePeriodStats(
  sessions: WalkSession[],
  dailyGoal: number,
  streakData: StreakData,
): PeriodStats {
  const totalWalks = sessions.length;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    const key = toLocalDateKey(new Date(s.endedAt));
    dayMap.set(key, (dayMap.get(key) || 0) + s.durationSeconds);
  }
  let goalDays = 0;
  for (const sec of dayMap.values()) {
    if (Math.floor(sec / 60) >= dailyGoal) goalDays++;
  }

  return {
    totalWalks,
    totalMinutes,
    goalDays,
    avgWalkMinutes: totalWalks > 0 ? Math.round(totalSeconds / 60 / totalWalks) : 0,
    currentStreak: streakData.currentStreak,
    longestStreak: streakData.longestStreak,
  };
}

export function computePurposeStats(sessions: WalkSession[]): PurposeStat[] {
  const map = new Map<string, {walks: number; seconds: number}>();
  for (const s of sessions) {
    const entry = map.get(s.purpose) || {walks: 0, seconds: 0};
    entry.walks++;
    entry.seconds += s.durationSeconds;
    map.set(s.purpose, entry);
  }
  const result: PurposeStat[] = [];
  for (const [purpose, data] of map) {
    result.push({purpose, walks: data.walks, totalMinutes: Math.floor(data.seconds / 60)});
  }
  result.sort((a, b) => b.totalMinutes - a.totalMinutes);
  return result;
}

export function computeDetailedStats(sessions: WalkSession[]): DetailedStats {
  if (sessions.length === 0) {
    return {avgWalksPerActiveDay: 0, avgWalkDuration: 0, bestDayDate: '', bestDayMinutes: 0, mostUsedPurpose: ''};
  }

  const dayMap = new Map<string, number>();
  const dayWalksMap = new Map<string, number>();
  const purposeMap = new Map<string, {walks: number; seconds: number}>();

  for (const s of sessions) {
    const key = toLocalDateKey(new Date(s.endedAt));
    dayMap.set(key, (dayMap.get(key) || 0) + s.durationSeconds);
    dayWalksMap.set(key, (dayWalksMap.get(key) || 0) + 1);
    const p = purposeMap.get(s.purpose) || {walks: 0, seconds: 0};
    p.walks++;
    p.seconds += s.durationSeconds;
    purposeMap.set(s.purpose, p);
  }

  const activeDays = dayMap.size;
  const avgWalksPerActiveDay = activeDays > 0 ? Math.round((sessions.length / activeDays) * 10) / 10 : 0;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const avgWalkDuration = Math.round(totalSeconds / 60 / sessions.length);

  let bestDayDate = '';
  let bestDaySeconds = 0;
  for (const [key, sec] of dayMap) {
    if (sec > bestDaySeconds) {
      bestDaySeconds = sec;
      bestDayDate = key;
    }
  }

  let mostUsedPurpose = '';
  let topWalks = 0;
  let topSeconds = 0;
  for (const [purpose, data] of purposeMap) {
    if (data.walks > topWalks || (data.walks === topWalks && data.seconds > topSeconds)) {
      mostUsedPurpose = purpose;
      topWalks = data.walks;
      topSeconds = data.seconds;
    }
  }

  return {
    avgWalksPerActiveDay,
    avgWalkDuration,
    bestDayDate,
    bestDayMinutes: Math.floor(bestDaySeconds / 60),
    mostUsedPurpose,
  };
}

// ── Group by local date ──

export type DayGroup = {
  dateKey: string;
  totalSeconds: number;
  sessions: WalkSession[];
};

export function groupSessionsByLocalDate(sessions: WalkSession[]): DayGroup[] {
  const map = new Map<string, WalkSession[]>();
  for (const s of sessions) {
    const key = toLocalDateKey(new Date(s.endedAt));
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }
  const groups: DayGroup[] = [];
  for (const [dateKey, sess] of map) {
    sess.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
    groups.push({
      dateKey,
      totalSeconds: sess.reduce((sum, s2) => sum + s2.durationSeconds, 0),
      sessions: sess,
    });
  }
  groups.sort((a, b) => (b.dateKey > a.dateKey ? 1 : -1));
  return groups;
}

// ── Reset ──

export async function resetAllData(): Promise<void> {
  const keys = Object.values(K);
  await AsyncStorage.multiRemove(keys);
}
