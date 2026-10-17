import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSessions,
  addSession,
  getProStatus,
  setProStatus,
  getDailyGoalMinutes,
  setDailyGoalMinutes,
  initFirstLaunchDate,
  getFirstLaunchDate,
  computeTrialInfo,
  formatTrialRemaining,
  filterSessionsByPeriod,
  computePeriodStats,
  computePurposeStats,
  computeDetailedStats,
  groupSessionsByLocalDate,
  toLocalDateKey,
  type WalkSession,
  type StreakData,
} from '../src/walkStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] || null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        for (const k of keys) delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
    },
    _clearStore: () => { store = {}; },
  };
});

const {_clearStore} = require('@react-native-async-storage/async-storage');

beforeEach(() => {
  _clearStore();
  jest.clearAllMocks();
});

function makeSession(overrides: Partial<WalkSession> = {}): WalkSession {
  const now = new Date();
  return {
    id: String(Date.now() + Math.random()),
    startedAt: new Date(now.getTime() - 600000).toISOString(),
    endedAt: now.toISOString(),
    durationSeconds: 600,
    purpose: 'explore',
    note: null,
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

const streakData: StreakData = {currentStreak: 3, longestStreak: 5, lastCompletedDate: toLocalDateKey(new Date())};

// ── Pro Status ──

describe('Pro Status', () => {
  test('default is false', async () => {
    expect(await getProStatus()).toBe(false);
  });

  test('set and get', async () => {
    await setProStatus(true);
    expect(await getProStatus()).toBe(true);
  });

  test('persists after re-read', async () => {
    await setProStatus(true);
    expect(await getProStatus()).toBe(true);
    await setProStatus(false);
    expect(await getProStatus()).toBe(false);
  });
});

// ── Period Filtering ──

describe('filterSessionsByPeriod', () => {
  const sessions: WalkSession[] = [
    makeSession({id: '1', endedAt: daysAgo(1).toISOString()}),
    makeSession({id: '2', endedAt: daysAgo(5).toISOString()}),
    makeSession({id: '3', endedAt: daysAgo(15).toISOString()}),
    makeSession({id: '4', endedAt: daysAgo(60).toISOString()}),
    makeSession({id: '5', endedAt: daysAgo(100).toISOString()}),
  ];

  test('7d returns only last 7 days', () => {
    const result = filterSessionsByPeriod(sessions, '7d');
    expect(result.map(s => s.id)).toEqual(['1', '2']);
  });

  test('30d returns last 30 days', () => {
    const result = filterSessionsByPeriod(sessions, '30d');
    expect(result.map(s => s.id)).toEqual(['1', '2', '3']);
  });

  test('90d returns last 90 days', () => {
    const result = filterSessionsByPeriod(sessions, '90d');
    expect(result.map(s => s.id)).toEqual(['1', '2', '3', '4']);
  });

  test('all returns everything', () => {
    const result = filterSessionsByPeriod(sessions, 'all');
    expect(result).toHaveLength(5);
  });
});

// ── Stats Aggregation ──

describe('computePeriodStats', () => {
  test('computes totals correctly', () => {
    const today = new Date();
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: today.toISOString(), durationSeconds: 600, purpose: 'music'}),
      makeSession({id: '2', endedAt: today.toISOString(), durationSeconds: 1200, purpose: 'explore'}),
    ];
    const stats = computePeriodStats(sessions, 20, streakData);
    expect(stats.totalWalks).toBe(2);
    expect(stats.totalMinutes).toBe(30);
    expect(stats.avgWalkMinutes).toBe(15);
  });

  test('goal days computed correctly', () => {
    const day1 = daysAgo(1);
    const day2 = daysAgo(2);
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: day1.toISOString(), durationSeconds: 1800}),
      makeSession({id: '2', endedAt: day2.toISOString(), durationSeconds: 300}),
    ];
    const stats = computePeriodStats(sessions, 20, streakData);
    expect(stats.goalDays).toBe(1);
  });

  test('empty sessions', () => {
    const stats = computePeriodStats([], 20, streakData);
    expect(stats.totalWalks).toBe(0);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.avgWalkMinutes).toBe(0);
    expect(stats.goalDays).toBe(0);
  });
});

// ── Purpose Analytics ──

describe('computePurposeStats', () => {
  test('groups by purpose and sorts by time', () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', purpose: 'music', durationSeconds: 600}),
      makeSession({id: '2', purpose: 'music', durationSeconds: 900}),
      makeSession({id: '3', purpose: 'explore', durationSeconds: 1800}),
    ];
    const stats = computePurposeStats(sessions);
    expect(stats).toHaveLength(2);
    expect(stats[0].purpose).toBe('explore');
    expect(stats[0].walks).toBe(1);
    expect(stats[0].totalMinutes).toBe(30);
    expect(stats[1].purpose).toBe('music');
    expect(stats[1].walks).toBe(2);
    expect(stats[1].totalMinutes).toBe(25);
  });

  test('includes custom purposes', () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', purpose: 'dog walking', durationSeconds: 1200}),
      makeSession({id: '2', purpose: 'music', durationSeconds: 600}),
    ];
    const stats = computePurposeStats(sessions);
    expect(stats.find(s => s.purpose === 'dog walking')).toBeDefined();
    expect(stats.find(s => s.purpose === 'dog walking')!.walks).toBe(1);
  });

  test('empty sessions', () => {
    expect(computePurposeStats([])).toEqual([]);
  });
});

// ── Detailed Stats ──

describe('computeDetailedStats', () => {
  test('computes best day and most used purpose', () => {
    const day1 = daysAgo(1);
    const day2 = daysAgo(2);
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: day1.toISOString(), purpose: 'music', durationSeconds: 600}),
      makeSession({id: '2', endedAt: day1.toISOString(), purpose: 'music', durationSeconds: 600}),
      makeSession({id: '3', endedAt: day2.toISOString(), purpose: 'explore', durationSeconds: 3600}),
    ];
    const stats = computeDetailedStats(sessions);
    expect(stats.bestDayDate).toBe(toLocalDateKey(day2));
    expect(stats.bestDayMinutes).toBe(60);
    expect(stats.mostUsedPurpose).toBe('music');
    expect(stats.avgWalksPerActiveDay).toBe(1.5);
  });

  test('empty returns zeros', () => {
    const stats = computeDetailedStats([]);
    expect(stats.avgWalksPerActiveDay).toBe(0);
    expect(stats.bestDayDate).toBe('');
    expect(stats.mostUsedPurpose).toBe('');
  });

  test('tie-breaking: same walk count, higher time wins', () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', purpose: 'music', durationSeconds: 600}),
      makeSession({id: '2', purpose: 'explore', durationSeconds: 1800}),
    ];
    const stats = computeDetailedStats(sessions);
    expect(stats.mostUsedPurpose).toBe('explore');
  });
});

// ── Custom Daily Goal ──

describe('Custom Daily Goal', () => {
  test('can set non-preset value', async () => {
    await setDailyGoalMinutes(35);
    expect(await getDailyGoalMinutes()).toBe(35);
  });

  test('streak uses custom goal', () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: new Date().toISOString(), durationSeconds: 2100}),
    ];
    const stats = computePeriodStats(sessions, 35, streakData);
    expect(stats.goalDays).toBe(1);
    expect(stats.totalMinutes).toBe(35);
  });

  test('goal not met with custom value', () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: new Date().toISOString(), durationSeconds: 1800}),
    ];
    const stats = computePeriodStats(sessions, 35, streakData);
    expect(stats.goalDays).toBe(0);
  });
});

// ── Data Retention ──

describe('Data Retention', () => {
  test('old sessions are not deleted by filtering', async () => {
    const oldSession = makeSession({id: 'old', endedAt: daysAgo(100).toISOString()});
    const recentSession = makeSession({id: 'recent', endedAt: daysAgo(1).toISOString()});

    await addSession(oldSession);
    await addSession(recentSession);

    const allSessions = await getSessions();
    expect(allSessions).toHaveLength(2);

    const filtered7d = filterSessionsByPeriod(allSessions, '7d');
    expect(filtered7d).toHaveLength(1);
    expect(filtered7d[0].id).toBe('recent');

    const stillAll = await getSessions();
    expect(stillAll).toHaveLength(2);
  });

  test('Pro unlocks all data instantly', async () => {
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: daysAgo(1).toISOString()}),
      makeSession({id: '2', endedAt: daysAgo(50).toISOString()}),
      makeSession({id: '3', endedAt: daysAgo(200).toISOString()}),
    ];

    const free7d = filterSessionsByPeriod(sessions, '7d');
    expect(free7d).toHaveLength(1);

    const proAll = filterSessionsByPeriod(sessions, 'all');
    expect(proAll).toHaveLength(3);
  });
});

// ── Trial ──

describe('Trial', () => {
  test('initFirstLaunchDate sets and returns timestamp', async () => {
    const ts = await initFirstLaunchDate();
    expect(ts).toBeGreaterThan(0);
    const ts2 = await initFirstLaunchDate();
    expect(ts2).toBe(ts);
  });

  test('computeTrialInfo active within 4 days', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const info = computeTrialInfo(twoHoursAgo);
    expect(info.active).toBe(true);
    expect(info.remainingMs).toBeGreaterThan(0);
  });

  test('computeTrialInfo expired after 4 days', () => {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const info = computeTrialInfo(fiveDaysAgo);
    expect(info.active).toBe(false);
    expect(info.remainingMs).toBe(0);
  });

  test('computeTrialInfo zero firstLaunch', () => {
    const info = computeTrialInfo(0);
    expect(info.active).toBe(false);
  });

  test('formatTrialRemaining days and hours', () => {
    const threeDays = 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000;
    expect(formatTrialRemaining(threeDays)).toBe('3d 5h');
  });

  test('formatTrialRemaining hours only', () => {
    const twoHours = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
    expect(formatTrialRemaining(twoHours)).toBe('2h');
  });

  test('formatTrialRemaining minutes only', () => {
    const tenMin = 10 * 60 * 1000;
    expect(formatTrialRemaining(tenMin)).toBe('10m');
  });

  test('formatTrialRemaining zero', () => {
    expect(formatTrialRemaining(0)).toBe('');
  });
});

// ── Group Sessions By Date ──

describe('groupSessionsByLocalDate', () => {
  const makeSess = (id: string, endedAt: string, dur: number, purpose = 'Music'): WalkSession => ({
    id, startedAt: endedAt, endedAt, durationSeconds: dur, purpose, note: null,
  });

  test('groups sessions by local date', () => {
    const sessions = [
      makeSess('1', '2026-10-18T18:00:00', 600, 'Music'),
      makeSess('2', '2026-10-18T14:00:00', 300, 'Shopping'),
      makeSess('3', '2026-10-17T16:00:00', 900, 'Explore'),
    ];
    const groups = groupSessionsByLocalDate(sessions);
    expect(groups.length).toBe(2);
    expect(groups[0].sessions.length).toBe(2);
    expect(groups[1].sessions.length).toBe(1);
  });

  test('totalSeconds is sum of sessions per day', () => {
    const sessions = [
      makeSess('1', '2026-10-18T18:00:00', 600),
      makeSess('2', '2026-10-18T14:00:00', 300),
    ];
    const groups = groupSessionsByLocalDate(sessions);
    expect(groups[0].totalSeconds).toBe(900);
  });

  test('newest date first, newest session first within day', () => {
    const sessions = [
      makeSess('1', '2026-10-17T09:00:00', 100),
      makeSess('2', '2026-10-18T10:00:00', 200),
      makeSess('3', '2026-10-18T20:00:00', 300),
    ];
    const groups = groupSessionsByLocalDate(sessions);
    expect(groups[0].dateKey).toContain('2026-10-18');
    expect(groups[0].sessions[0].id).toBe('3');
    expect(groups[0].sessions[1].id).toBe('2');
  });

  test('empty sessions returns empty', () => {
    expect(groupSessionsByLocalDate([])).toEqual([]);
  });

  test('single session in one group', () => {
    const sessions = [makeSess('1', '2026-10-18T12:00:00', 500)];
    const groups = groupSessionsByLocalDate(sessions);
    expect(groups.length).toBe(1);
    expect(groups[0].sessions.length).toBe(1);
    expect(groups[0].totalSeconds).toBe(500);
  });

  test('note is preserved in grouped sessions', () => {
    const sess: WalkSession = {
      id: '1', startedAt: '2026-10-18T12:00:00', endedAt: '2026-10-18T12:30:00',
      durationSeconds: 1800, purpose: 'Music', note: 'Nice walk',
    };
    const groups = groupSessionsByLocalDate([sess]);
    expect(groups[0].sessions[0].note).toBe('Nice walk');
  });
});
