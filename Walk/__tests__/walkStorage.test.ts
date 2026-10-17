import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSessions,
  addSession,
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  getDailyGoalMinutes,
  setDailyGoalMinutes,
  getStreakData,
  updateStreak,
  getLiveStreak,
  getTodayWalkSeconds,
  getElapsedSeconds,
  toLocalDateKey,
  resetAllData,
  type WalkSession,
  type ActiveSession,
  type StreakData,
} from '../src/walkStorage';

// Mock AsyncStorage
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
      multiGet: jest.fn((keys: string[]) =>
        Promise.resolve(keys.map(k => [k, store[k] || null])),
      ),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
    _getStore: () => store,
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
    id: String(Date.now()),
    startedAt: new Date(now.getTime() - 600000).toISOString(),
    endedAt: now.toISOString(),
    durationSeconds: 600,
    purpose: 'explore',
    note: null,
    ...overrides,
  };
}

// ── Tests ──

describe('Sessions', () => {
  test('add and get sessions', async () => {
    const s1 = makeSession({id: '1', durationSeconds: 480});
    const s2 = makeSession({id: '2', durationSeconds: 840});
    await addSession(s1);
    await addSession(s2);
    const all = await getSessions();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('2');
    expect(all[1].id).toBe('1');
  });
});

describe('Active Session', () => {
  test('save and restore', async () => {
    const active: ActiveSession = {
      startedAt: Date.now() - 60000,
      purpose: 'music',
      isPaused: false,
      pausedAt: 0,
      totalPausedDuration: 0,
    };
    await saveActiveSession(active);
    const restored = await getActiveSession();
    expect(restored).not.toBeNull();
    expect(restored!.purpose).toBe('music');
  });

  test('clear active session', async () => {
    await saveActiveSession({startedAt: Date.now(), purpose: 'think', isPaused: false, pausedAt: 0, totalPausedDuration: 0});
    await clearActiveSession();
    expect(await getActiveSession()).toBeNull();
  });
});

describe('Elapsed Seconds', () => {
  test('running session', () => {
    const now = Date.now();
    const active: ActiveSession = {
      startedAt: now - 120000,
      purpose: 'music',
      isPaused: false,
      pausedAt: 0,
      totalPausedDuration: 0,
    };
    const elapsed = getElapsedSeconds(active);
    expect(elapsed).toBeGreaterThanOrEqual(119);
    expect(elapsed).toBeLessThanOrEqual(121);
  });

  test('paused session excludes pause time', () => {
    const now = Date.now();
    const active: ActiveSession = {
      startedAt: now - 120000,
      purpose: 'music',
      isPaused: true,
      pausedAt: now - 60000,
      totalPausedDuration: 0,
    };
    const elapsed = getElapsedSeconds(active);
    expect(elapsed).toBe(60);
  });

  test('paused with prior pauses', () => {
    const now = Date.now();
    const active: ActiveSession = {
      startedAt: now - 300000,
      purpose: 'music',
      isPaused: true,
      pausedAt: now - 60000,
      totalPausedDuration: 120000,
    };
    const elapsed = getElapsedSeconds(active);
    // 300s total - 120s prior pause - 60s current pause? No, pausedAt calc:
    // beforePause = pausedAt - startedAt - totalPausedDuration = 240000 - 120000 = 120000ms = 120s
    expect(elapsed).toBe(120);
  });
});

describe('Daily Goal', () => {
  test('default is 20', async () => {
    expect(await getDailyGoalMinutes()).toBe(20);
  });

  test('set and get', async () => {
    await setDailyGoalMinutes(30);
    expect(await getDailyGoalMinutes()).toBe(30);
  });
});

describe('Today Walk Seconds', () => {
  test('sums sessions from today only', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: today.toISOString(), durationSeconds: 480}),
      makeSession({id: '2', endedAt: today.toISOString(), durationSeconds: 840}),
      makeSession({id: '3', endedAt: yesterday.toISOString(), durationSeconds: 600}),
    ];

    const total = getTodayWalkSeconds(sessions);
    expect(total).toBe(1320); // 480 + 840
  });

  test('multiple sessions meet goal', () => {
    const today = new Date();
    const sessions: WalkSession[] = [
      makeSession({id: '1', endedAt: today.toISOString(), durationSeconds: 480}),
      makeSession({id: '2', endedAt: today.toISOString(), durationSeconds: 840}),
    ];
    const totalMin = Math.floor(getTodayWalkSeconds(sessions) / 60);
    expect(totalMin).toBe(22);
    expect(totalMin >= 20).toBe(true); // goal met
  });
});

describe('Streak', () => {
  test('first completion starts streak at 1', async () => {
    const result = await updateStreak();
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.lastCompletedDate).toBe(toLocalDateKey(new Date()));
  });

  test('same day does not increment', async () => {
    await updateStreak();
    const result = await updateStreak();
    expect(result.currentStreak).toBe(1);
  });

  test('consecutive day increments', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterday);

    // Simulate yesterday completion
    const store = require('@react-native-async-storage/async-storage').default;
    await store.setItem('walk_current_streak', '3');
    await store.setItem('walk_longest_streak', '5');
    await store.setItem('walk_last_completed_date', yesterdayKey);

    const result = await updateStreak();
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(5);
  });

  test('gap resets streak to 1', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const store = require('@react-native-async-storage/async-storage').default;
    await store.setItem('walk_current_streak', '5');
    await store.setItem('walk_longest_streak', '5');
    await store.setItem('walk_last_completed_date', toLocalDateKey(twoDaysAgo));

    const result = await updateStreak();
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(5); // preserved
  });

  test('longest streak is preserved after gap', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const store = require('@react-native-async-storage/async-storage').default;
    await store.setItem('walk_current_streak', '10');
    await store.setItem('walk_longest_streak', '10');
    await store.setItem('walk_last_completed_date', toLocalDateKey(twoDaysAgo));

    const result = await updateStreak();
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(10);
  });
});

describe('getLiveStreak', () => {
  test('returns 0 when no data', () => {
    expect(getLiveStreak({currentStreak: 0, longestStreak: 0, lastCompletedDate: ''})).toBe(0);
  });

  test('returns streak for today', () => {
    const today = toLocalDateKey(new Date());
    expect(getLiveStreak({currentStreak: 3, longestStreak: 5, lastCompletedDate: today})).toBe(3);
  });

  test('returns streak for yesterday (still valid)', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = toLocalDateKey(yesterday);
    expect(getLiveStreak({currentStreak: 3, longestStreak: 5, lastCompletedDate: key})).toBe(3);
  });

  test('returns 0 for two days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const key = toLocalDateKey(d);
    expect(getLiveStreak({currentStreak: 3, longestStreak: 5, lastCompletedDate: key})).toBe(0);
  });
});

describe('Reset', () => {
  test('clears all data', async () => {
    await addSession(makeSession());
    await setDailyGoalMinutes(30);
    await resetAllData();
    expect(await getSessions()).toEqual([]);
    expect(await getDailyGoalMinutes()).toBe(20);
  });
});
