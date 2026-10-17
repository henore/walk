import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  AppState,
  Animated,
  Easing,
  StatusBar,
  useColorScheme,
  type AppStateStatus,
} from 'react-native';
import {
  getSessions,
  addSession,
  deleteSession,
  updateSession,
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  getDailyGoalMinutes,
  setDailyGoalMinutes,
  getGoalNotifEnabled,
  setGoalNotifEnabled,
  getGoalNotifiedDate,
  setGoalNotifiedDate,
  getReminderEnabled,
  setReminderEnabled,
  getReminderTime,
  setReminderTime,
  getCustomPurposes,
  setCustomPurposes,
  getThemeMode,
  setThemeMode as saveThemeMode,
  getStreakData,
  updateStreak,
  getLiveStreak,
  getTodayWalkSeconds,
  getElapsedSeconds,
  resetAllData,
  toLocalDateKey,
  getProStatus,
  setProStatus,
  initFirstLaunchDate,
  computeTrialInfo,
  formatTrialRemaining,
  filterSessionsByPeriod,
  computePeriodStats,
  computePurposeStats,
  computeDetailedStats,
  DEFAULT_PURPOSES,
  type WalkSession,
  type ActiveSession,
  type ThemeMode,
  type StreakData,
} from './walkStorage';
import {
  showGoalNotification,
  scheduleDailyReminder,
  cancelDailyReminder,
} from './walkNotifications';
import {initBilling, purchasePro, restorePurchases, endBilling} from './purchase';
import {t, initLocale, changeLocale, getCurrentLocale, LANGUAGE_NAMES, AVAILABLE_LANGUAGES} from './i18n';
import {getColors, createStyles, LightColors, type ColorSet} from './styles';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';

const APP_ICON = require('./assets/app-icon.png');

// ── Toggle ──

function Toggle({value, onValueChange, trackOn, trackOff, thumb}: {value: boolean; onValueChange: (v: boolean) => void; trackOn: string; trackOff: string; thumb: string}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {toValue: value ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false}).start();
  }, [value, anim]);
  const trackColor = anim.interpolate({inputRange: [0, 1], outputRange: [trackOff, trackOn]});
  const translateX = anim.interpolate({inputRange: [0, 1], outputRange: [2, 22]});
  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={{width: 48, height: 28, borderRadius: 14, backgroundColor: trackColor, justifyContent: 'center'}}>
        <Animated.View style={{width: 24, height: 24, borderRadius: 12, backgroundColor: thumb, transform: [{translateX}], shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2}} />
      </Animated.View>
    </Pressable>
  );
}

// ── Purpose Icons ──

const PURPOSE_ICONS: Record<string, string> = {
  music: '♪',
  explore: '◎',
  shopping: '🛒',
  errand: '✓',
  think: '💡',
  other: '···',
};

function purposeIcon(purpose: string): string {
  return PURPOSE_ICONS[purpose] || '•';
}

function purposeLabel(purpose: string): string {
  const key = `purpose_${purpose}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
}

// ── Tab Icons ──

type Tab = 'home' | 'stats' | 'history' | 'settings';

function TabBarIcon({name, color}: {name: Tab; color: string}) {
  const icons: Record<Tab, string> = {home: '⌂', stats: '▦', history: '⏱', settings: '⚙'};
  return <Text style={{fontSize: 20, color}}>{icons[name]}</Text>;
}

// ── Format helpers ──

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

// ── Main Component ──

export default function WalkApp() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('home');
  const [subScreen, setSubScreen] = useState<string | null>(null);

  // State
  const [sessions, setSessions] = useState<WalkSession[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedPurpose, setSelectedPurpose] = useState('music');
  const [dailyGoal, setDailyGoal] = useState(20);
  const [streak, setStreak] = useState<StreakData>({currentStreak: 0, longestStreak: 0, lastCompletedDate: ''});
  const [goalNotifEnabled, setGoalNotifState] = useState(true);
  const [reminderEnabled, setReminderState] = useState(false);
  const [reminderTime, setReminderTimeState] = useState('20:00');
  const [customPurposes, setCustomPurposesState] = useState<string[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [completedSession, setCompletedSession] = useState<WalkSession | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(0);
  const [trialTick, setTrialTick] = useState(0);
  const [localeKey, setLocaleKey] = useState(0);

  const resolvedMode: 'light' | 'dark' = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const c = useMemo(() => getColors(resolvedMode), [resolvedMode]);
  const s = useMemo(() => createStyles(c), [c]);

  const todaySeconds = useMemo(() => getTodayWalkSeconds(sessions), [sessions]);
  const todayMinutes = formatMinutes(todaySeconds);
  const liveStreak = getLiveStreak(streak);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const trialInfo = useMemo(() => computeTrialInfo(firstLaunch), [firstLaunch, trialTick]);
  const effectivePro = isPro || trialInfo.active;
  const trialLabel = !isPro && trialInfo.active ? t('trial_badge', formatTrialRemaining(trialInfo.remainingMs)) : '';

  // ── Init ──

  useEffect(() => {
    (async () => {
      await initLocale();
      const [sess, active, goal, sd, gn, re, rt, cp, tm, pro, fl] = await Promise.all([
        getSessions(),
        getActiveSession(),
        getDailyGoalMinutes(),
        getStreakData(),
        getGoalNotifEnabled(),
        getReminderEnabled(),
        getReminderTime(),
        getCustomPurposes(),
        getThemeMode(),
        getProStatus(),
        initFirstLaunchDate(),
      ]);
      setSessions(sess);
      setActiveSession(active);
      if (active) setElapsedSec(getElapsedSeconds(active));
      setDailyGoal(goal);
      setStreak(sd);
      setGoalNotifState(gn);
      setReminderState(re);
      setReminderTimeState(rt);
      setCustomPurposesState(cp);
      setThemeMode(tm);
      setIsPro(pro);
      setFirstLaunch(fl);
      initBilling();
      setLoading(false);
    })();
  }, []);

  // ── Trial countdown tick ──

  useEffect(() => {
    if (isPro || !trialInfo.active) return;
    const interval = setInterval(() => setTrialTick(k => k + 1), 60000);
    return () => clearInterval(interval);
  }, [isPro, trialInfo.active]);

  // ── Timer tick ──

  useEffect(() => {
    if (!activeSession || activeSession.isPaused) return;
    const interval = setInterval(() => {
      setElapsedSec(getElapsedSeconds(activeSession));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // ── AppState restore ──

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active') {
        const active = await getActiveSession();
        setActiveSession(active);
        if (active) setElapsedSec(getElapsedSeconds(active));
        const sess = await getSessions();
        setSessions(sess);
        const sd = await getStreakData();
        setStreak(sd);
        scheduleReminder();
      }
    });
    return () => sub.remove();
  }, [scheduleReminder]);

  // ── Actions ──

  const startWalk = useCallback(async () => {
    const now = Date.now();
    const session: ActiveSession = {
      startedAt: now,
      purpose: selectedPurpose,
      isPaused: false,
      pausedAt: 0,
      totalPausedDuration: 0,
    };
    await saveActiveSession(session);
    setActiveSession(session);
    setElapsedSec(0);
  }, [selectedPurpose]);

  const pauseWalk = useCallback(async () => {
    if (!activeSession) return;
    const updated: ActiveSession = {
      ...activeSession,
      isPaused: true,
      pausedAt: Date.now(),
    };
    await saveActiveSession(updated);
    setActiveSession(updated);
  }, [activeSession]);

  const resumeWalk = useCallback(async () => {
    if (!activeSession) return;
    const now = Date.now();
    const pausedDelta = now - activeSession.pausedAt;
    const updated: ActiveSession = {
      ...activeSession,
      isPaused: false,
      pausedAt: 0,
      totalPausedDuration: activeSession.totalPausedDuration + pausedDelta,
    };
    await saveActiveSession(updated);
    setActiveSession(updated);
  }, [activeSession]);

  const finishWalk = useCallback(async () => {
    if (!activeSession) return;
    const now = Date.now();
    let totalPaused = activeSession.totalPausedDuration;
    if (activeSession.isPaused) {
      totalPaused += now - activeSession.pausedAt;
    }
    const durationMs = now - activeSession.startedAt - totalPaused;
    const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

    const pausedSeconds = Math.max(0, Math.floor(totalPaused / 1000));
    const session: WalkSession = {
      id: String(activeSession.startedAt),
      startedAt: new Date(activeSession.startedAt).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationSeconds,
      pausedSeconds,
      purpose: activeSession.purpose,
      note: null,
    };

    await addSession(session);
    await clearActiveSession();

    const updatedSessions = [session, ...sessions];
    setSessions(updatedSessions);
    setActiveSession(null);

    const newTodaySeconds = getTodayWalkSeconds(updatedSessions);
    const newTodayMinutes = Math.floor(newTodaySeconds / 60);
    const goalReached = newTodayMinutes >= dailyGoal;

    if (goalReached) {
      const newStreak = await updateStreak();
      setStreak(newStreak);

      await cancelDailyReminder();

      if (goalNotifEnabled) {
        const notifiedDate = await getGoalNotifiedDate();
        const today = toLocalDateKey(new Date());
        if (notifiedDate !== today) {
          await showGoalNotification(newTodayMinutes);
          await setGoalNotifiedDate(today);
        }
      }
    }

    setCompletedSession(session);
    setShowComplete(true);
    setNoteText('');
  }, [activeSession, sessions, dailyGoal, goalNotifEnabled]);

  const saveNote = useCallback(async () => {
    if (completedSession) {
      const note = noteText.trim() || null;
      const updated = {...completedSession, note};
      const updatedSessions = sessions.map(s2 =>
        s2.id === updated.id ? updated : s2,
      );
      setSessions(updatedSessions);
      const all = await getSessions();
      const allUpdated = all.map(s2 => s2.id === updated.id ? updated : s2);
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('walk_sessions', JSON.stringify(allUpdated));
    }
    setShowComplete(false);
    setCompletedSession(null);
  }, [completedSession, noteText, sessions]);

  // ── Daily Reminder scheduling ──

  const scheduleReminder = useCallback(async () => {
    if (!reminderEnabled) {
      await cancelDailyReminder();
      return;
    }
    const [hStr, mStr] = reminderTime.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const todaySec = getTodayWalkSeconds(sessions);
    const todayMin = Math.floor(todaySec / 60);
    if (todayMin >= dailyGoal) {
      await cancelDailyReminder();
      return;
    }
    const remaining = dailyGoal - todayMin;
    await scheduleDailyReminder(target.getTime(), remaining);
  }, [reminderEnabled, reminderTime, sessions, dailyGoal]);

  useEffect(() => {
    if (!loading) scheduleReminder();
  }, [loading, reminderEnabled, reminderTime, scheduleReminder]);

  // ── Render ──

  if (loading) {
    return (
      <View style={[s.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
      </View>
    );
  }

  if (subScreen === 'pro') {
    return (
      <View style={s.container}>
        <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
        <View style={s.subHeader}>
          <Pressable onPress={() => setSubScreen(null)}>
            <Text style={s.subHeaderBack}>{t('back')}</Text>
          </Pressable>
          <Text style={s.subHeaderTitle}>{t('pro_title')}</Text>
          <View style={{width: 50}} />
        </View>
        <ProUpgradeScreen
          isPro={isPro}
          onPurchase={async () => {
            const ok = await purchasePro();
            if (ok) { setIsPro(true); setSubScreen(null); }
          }}
          onRestore={async () => {
            const ok = await restorePurchases();
            if (ok) {
              setIsPro(true);
              Alert.alert(t('restore_purchases'), t('restore_success'));
              setSubScreen(null);
            } else {
              Alert.alert(t('restore_purchases'), t('restore_fail'));
            }
          }}
          c={c}
          s={s}
        />
      </View>
    );
  }

  if (subScreen === 'privacy') {
    return (
      <View style={s.container}>
        <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
        <View style={s.subHeader}>
          <Pressable onPress={() => setSubScreen(null)}>
            <Text style={s.subHeaderBack}>{t('back')}</Text>
          </Pressable>
          <Text style={s.subHeaderTitle}>{t('privacy_policy')}</Text>
          <View style={{width: 50}} />
        </View>
        <PrivacyPolicyScreen />
      </View>
    );
  }

  if (subScreen === 'language') {
    return (
      <View style={s.container}>
        <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
        <View style={s.subHeader}>
          <Pressable onPress={() => setSubScreen(null)}>
            <Text style={s.subHeaderBack}>{t('back')}</Text>
          </Pressable>
          <Text style={s.subHeaderTitle}>{t('language')}</Text>
          <View style={{width: 50}} />
        </View>
        <ScrollView style={s.subBody}>
          {AVAILABLE_LANGUAGES.map(lang => (
            <Pressable
              key={lang}
              style={[s.settingsRow, s.settingsRowBorder]}
              onPress={async () => {
                await changeLocale(lang);
                setLocaleKey(k => k + 1);
                setSubScreen(null);
              }}>
              <Text style={[s.settingsRowText, getCurrentLocale() === lang && {color: c.accent, fontWeight: '700'}]}>
                {LANGUAGE_NAMES[lang]}
              </Text>
              {getCurrentLocale() === lang && <Text style={{color: c.accent, fontSize: 18}}>✓</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container} key={localeKey}>
      <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />

      {/* Walk Complete overlay */}
      {showComplete && completedSession && (
        <WalkCompleteScreen
          session={completedSession}
          streak={liveStreak}
          noteText={noteText}
          onNoteChange={setNoteText}
          onSave={saveNote}
          c={c}
          s={s}
        />
      )}

      {!showComplete && (
        <>
          <View style={s.tabContent}>
            {tab === 'home' && (
              <HomeTab
                activeSession={activeSession}
                elapsedSec={elapsedSec}
                todayMinutes={todayMinutes}
                dailyGoal={dailyGoal}
                liveStreak={liveStreak}
                selectedPurpose={selectedPurpose}
                onSelectPurpose={setSelectedPurpose}
                allPurposes={[...DEFAULT_PURPOSES, ...customPurposes]}
                onStart={startWalk}
                onPause={pauseWalk}
                onResume={resumeWalk}
                onFinish={finishWalk}
                trialLabel={trialLabel}
                c={c}
                s={s}
              />
            )}
            {tab === 'stats' && (
              <StatsTab sessions={sessions} dailyGoal={dailyGoal} streak={streak} isPro={effectivePro} onOpenPro={() => setSubScreen('pro')} c={c} s={s} />
            )}
            {tab === 'history' && (
              <HistoryTab sessions={sessions} isPro={effectivePro} onOpenPro={() => setSubScreen('pro')} onDelete={async (id) => { const updated = await deleteSession(id); setSessions(updated); }} onUpdate={async (id, u) => { const updated = await updateSession(id, u); setSessions(updated); }} allPurposes={[...DEFAULT_PURPOSES, ...customPurposes]} c={c} s={s} />
            )}
            {tab === 'settings' && (
              <SettingsTab
                dailyGoal={dailyGoal}
                onDailyGoalChange={async (v) => { setDailyGoal(v); await setDailyGoalMinutes(v); }}
                goalNotifEnabled={goalNotifEnabled}
                onGoalNotifChange={async (v) => { setGoalNotifState(v); await setGoalNotifEnabled(v); }}
                reminderEnabled={reminderEnabled}
                onReminderChange={async (v) => { setReminderState(v); await setReminderEnabled(v); }}
                reminderTime={reminderTime}
                onReminderTimeChange={async (v) => { setReminderTimeState(v); await setReminderTime(v); }}
                customPurposes={customPurposes}
                onCustomPurposesChange={async (v) => { setCustomPurposesState(v); await setCustomPurposes(v); }}
                themeMode={themeMode}
                onThemeChange={async (v) => { setThemeMode(v); await saveThemeMode(v); }}
                isPro={effectivePro}
                onOpenPro={() => setSubScreen('pro')}
                onOpenLanguage={() => setSubScreen('language')}
                onOpenPrivacy={() => setSubScreen('privacy')}
                onReset={async () => {
                  await resetAllData();
                  setSessions([]);
                  setActiveSession(null);
                  setStreak({currentStreak: 0, longestStreak: 0, lastCompletedDate: ''});
                  setDailyGoal(20);
                  setGoalNotifState(true);
                  setReminderState(false);
                  setCustomPurposesState([]);
                }}
                c={c}
                s={s}
              />
            )}
          </View>

          {/* Tab Bar */}
          <View style={s.tabBar}>
            {(['home', 'stats', 'history', 'settings'] as Tab[]).map(t2 => (
              <Pressable key={t2} style={s.tabItem} onPress={() => setTab(t2)}>
                <TabBarIcon name={t2} color={tab === t2 ? c.accent : c.textDim} />
                <Text style={[s.tabLabel, tab === t2 && s.tabActive]}>
                  {t(`tab_${t2}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ── Home Tab ──

function HomeTab({
  activeSession, elapsedSec, todayMinutes, dailyGoal, liveStreak,
  selectedPurpose, onSelectPurpose, allPurposes,
  onStart, onPause, onResume, onFinish, trialLabel, c, s,
}: {
  activeSession: ActiveSession | null;
  elapsedSec: number;
  todayMinutes: number;
  dailyGoal: number;
  liveStreak: number;
  selectedPurpose: string;
  onSelectPurpose: (p: string) => void;
  allPurposes: string[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  trialLabel: string;
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const isLight = c.bg === LightColors.bg;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeSession) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {toValue: 0.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(blinkAnim, {toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activeSession, blinkAnim]);

  if (activeSession) {
    const currentTotalSec = todayMinutes * 60 + elapsedSec;
    const currentTotalMin = Math.floor(currentTotalSec / 60);
    const remaining = dailyGoal - currentTotalMin;
    const goalDone = remaining <= 0;

    return (
      <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
        {/* Header */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20}}>
          <Image source={APP_ICON} style={{width: 38, height: 38, borderRadius: 10}} />
          <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, flex: 1}} numberOfLines={1}>
            Walk Intent
          </Text>
          {trialLabel !== '' && (
            <View style={{backgroundColor: c.accentDark, borderRadius: 8, borderWidth: 1, borderColor: c.accent, paddingHorizontal: 8, paddingVertical: 3}}>
              <Text style={{color: c.accent, fontSize: 11, fontWeight: '700'}}>{trialLabel}</Text>
            </View>
          )}
        </View>

        {/* Timer card */}
        <View style={[s.timerCard, {marginBottom: 16}]}>
          <Text style={s.timer} numberOfLines={1} adjustsFontSizeToFit>{formatDuration(elapsedSec)}</Text>
          <View style={{marginTop: 16, alignItems: 'center'}}>
            <Text style={{color: c.accent, fontSize: 16, fontWeight: '600'}}>
              {purposeLabel(activeSession.purpose)}
            </Text>
          </View>
          <View style={{marginTop: 12}}>
            {goalDone ? (
              <Text style={{color: c.accent, fontSize: 14, fontWeight: '600'}}>
                {t('daily_goal_completed')}
              </Text>
            ) : (
              <Text style={{color: c.textMuted, fontSize: 14}}>
                {t('min_to_goal', String(remaining))}
              </Text>
            )}
          </View>
          <Animated.Text style={{color: '#7ECFB3', fontSize: 13, fontWeight: '400', textAlign: 'center', marginTop: 14, opacity: blinkAnim}}>
            {activeSession.isPaused ? 'Paused' : 'Walking'}
          </Animated.Text>
        </View>

        {/* Controls */}
        <View style={s.controlRow}>
          {activeSession.isPaused ? (
            <>
              <Pressable style={[s.controlBtn, {flex: 2}]} onPress={onResume}>
                <Text style={s.controlBtnText}>{t('resume_btn')}</Text>
              </Pressable>
              <Pressable
                style={[s.controlBtn, {flex: 1, backgroundColor: isLight ? '#FCEAE6' : '#2A1D1A', borderWidth: 1, borderColor: isLight ? '#E8B8AE' : '#3A2820'}]}
                onPress={onFinish}>
                <Text style={[s.controlBtnText, {color: c.danger}]}>{t('finish_btn')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[s.controlBtn, {flex: 1, backgroundColor: isLight ? '#D8EFEA' : '#1A1F2E', borderWidth: 1, borderColor: c.cardBorder}]}
                onPress={onPause}>
                <Text style={[s.controlBtnText, {color: c.textMuted}]}>{t('pause_btn')}</Text>
              </Pressable>
              <Pressable
                style={[s.controlBtn, {flex: 1, backgroundColor: isLight ? '#FCEAE6' : '#2A1D1A', borderWidth: 1, borderColor: isLight ? '#E8B8AE' : '#3A2820'}]}
                onPress={onFinish}>
                <Text style={[s.controlBtnText, {color: c.danger}]}>{t('finish_btn')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  // Pre-walk state
  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
      {/* Header */}
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20}}>
        <Image source={APP_ICON} style={{width: 38, height: 38, borderRadius: 10}} />
        <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, flex: 1}} numberOfLines={1}>
          Walk Intent
        </Text>
        {trialLabel !== '' && (
          <View style={{backgroundColor: c.accentDark, borderRadius: 8, borderWidth: 1, borderColor: c.accent, paddingHorizontal: 8, paddingVertical: 3}}>
            <Text style={{color: c.accent, fontSize: 11, fontWeight: '700'}}>{trialLabel}</Text>
          </View>
        )}
      </View>

      {/* Today progress */}
      <View style={{flexDirection: 'row', gap: 12, marginBottom: 20}}>
        <View style={[s.card, {flex: 1, alignItems: 'center'}]}>
          <Text style={{color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6}}>
            {t('today_label')}
          </Text>
          <Text style={{color: c.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums']}}>
            {todayMinutes} / {dailyGoal}
          </Text>
          <Text style={{color: c.textMuted, fontSize: 13}}>min</Text>
          {todayMinutes >= dailyGoal && (
            <Text style={{color: c.accent, fontSize: 13, fontWeight: '600', marginTop: 4}}>✓</Text>
          )}
        </View>
        <View style={[s.card, {flex: 1, alignItems: 'center'}]}>
          <Text style={{color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6}}>
            {t('current_streak')}
          </Text>
          <Text style={{color: c.text, fontSize: 24, fontWeight: '800'}}>
            🔥 {liveStreak}
          </Text>
          <Text style={{color: c.textMuted, fontSize: 13}}>{t('day_streak', String(liveStreak))}</Text>
        </View>
      </View>

      {/* Purpose selection */}
      <Text style={{color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 14}}>
        {t('what_walking_for')}
      </Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24}}>
        {allPurposes.map(p => {
          const active = p === selectedPurpose;
          return (
            <Pressable
              key={p}
              onPress={() => onSelectPurpose(p)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '47%',
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: active ? c.accent : c.cardBorder,
                backgroundColor: active ? c.accentDark : c.card,
              }}>
              <Text style={{fontSize: 16}}>{purposeIcon(p)}</Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: active ? c.accent : c.textMuted,
              }}>
                {purposeLabel(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Start button */}
      <Pressable
        style={({pressed}) => [
          s.button,
          {alignSelf: 'stretch', borderRadius: 16, paddingVertical: 18},
          pressed && s.buttonPressed,
        ]}
        onPress={onStart}>
        <Text style={s.buttonText}>{t('start_walk')}</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Walk Complete Screen ──

function WalkCompleteScreen({session, streak, noteText, onNoteChange, onSave, c, s}: {
  session: WalkSession;
  streak: number;
  noteText: string;
  onNoteChange: (t: string) => void;
  onSave: () => void;
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const durationMin = Math.floor(session.durationSeconds / 60);

  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 80}} contentContainerStyle={{alignItems: 'center', paddingBottom: 40}}>
      <Text style={{color: c.accent, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16}}>
        {t('walk_complete')}
      </Text>

      <Text style={{color: c.text, fontSize: 56, fontWeight: '800', marginBottom: 8}}>
        {durationMin}
      </Text>
      <Text style={{color: c.textMuted, fontSize: 16, marginBottom: 20}}>min</Text>

      <Text style={{color: c.text, fontSize: 18, fontWeight: '600', marginBottom: 8}}>
        {purposeLabel(session.purpose)}
      </Text>

      {streak > 0 && (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24}}>
          <Text style={{fontSize: 18}}>🔥</Text>
          <Text style={{color: c.text, fontSize: 16, fontWeight: '700'}}>
            {t('day_streak', String(streak))}
          </Text>
        </View>
      )}

      {/* Note input */}
      <View style={{width: '100%', marginTop: 16}}>
        <Text style={{color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8}}>
          {t('add_note')}
        </Text>
        <TextInput
          style={{
            backgroundColor: c.inputBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.inputBorder,
            color: c.text,
            fontSize: 15,
            padding: 14,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
          placeholder={t('note_placeholder')}
          placeholderTextColor={c.textDim}
          multiline
          value={noteText}
          onChangeText={onNoteChange}
        />
      </View>

      <Pressable
        style={({pressed}) => [s.button, {marginTop: 24, alignSelf: 'stretch', borderRadius: 16, paddingVertical: 18}, pressed && s.buttonPressed]}
        onPress={onSave}>
        <Text style={s.buttonText}>{t('save_btn')}</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── History Tab ──

type StatsPeriod = '7d' | '30d' | '90d' | 'all';

function StatsTab({sessions, dailyGoal, streak, isPro, onOpenPro, c, s}: {
  sessions: WalkSession[];
  dailyGoal: number;
  streak: StreakData;
  isPro: boolean;
  onOpenPro: () => void;
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const isLight = c.bg === LightColors.bg;
  const [period, setPeriod] = useState<StatsPeriod>('7d');

  const filteredSessions = useMemo(
    () => filterSessionsByPeriod(sessions, period),
    [sessions, period],
  );

  const periodStats = useMemo(
    () => computePeriodStats(filteredSessions, dailyGoal, streak),
    [filteredSessions, dailyGoal, streak],
  );

  const purposeStats = useMemo(
    () => computePurposeStats(filteredSessions),
    [filteredSessions],
  );

  const detailedStats = useMemo(
    () => computeDetailedStats(filteredSessions),
    [filteredSessions],
  );

  // 7-day bar chart data (always shown)
  const days = useMemo(() => {
    const result: {key: string; label: string; totalSec: number; goalMet: boolean}[] = [];
    const dayLabels = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      let totalSec = 0;
      for (const sess of sessions) {
        if (toLocalDateKey(new Date(sess.endedAt)) === key) {
          totalSec += sess.durationSeconds;
        }
      }
      result.push({key, label: dayLabels[d.getDay()], totalSec, goalMet: Math.floor(totalSec / 60) >= dailyGoal});
    }
    return result;
  }, [sessions, dailyGoal]);

  const maxSec = Math.max(...days.map(d => d.totalSec), 1);

  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
      <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginBottom: 20}}>
        {t('tab_stats')}
      </Text>

      {sessions.length === 0 ? (
        <View style={{alignItems: 'center', marginTop: 40}}>
          <Text style={{color: c.text, fontSize: 17, fontWeight: '600', marginBottom: 8}}>{t('no_walks_yet')}</Text>
          <Text style={{color: c.textDim, fontSize: 14, textAlign: 'center'}}>{t('no_walks_body')}</Text>
        </View>
      ) : (
        <>
          {/* Period Selector (Pro shows all, Free locked to 7D) */}
          {isPro && (
            <View style={{flexDirection: 'row', gap: 6, marginBottom: 16}}>
              {(['7d', '30d', '90d', 'all'] as StatsPeriod[]).map(p => (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: p === period ? c.accent : c.cardBorder,
                    backgroundColor: p === period ? c.accentDark : c.card,
                    alignItems: 'center',
                  }}>
                  <Text style={{fontSize: 13, fontWeight: '600', color: p === period ? c.accent : c.textMuted}}>
                    {t(`period_${p}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Summary */}
          <Text style={{color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12}}>
            {!isPro || period === '7d' ? t('last_7_days') : t(`period_${period}`)}
          </Text>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
            <SummaryCard label={t('total_walks')} value={String(periodStats.totalWalks)} c={c} s={s} />
            <SummaryCard label={t('walk_time')} value={`${periodStats.totalMinutes} min`} c={c} s={s} />
            <SummaryCard label={t('goal_days')} value={String(periodStats.goalDays)} c={c} s={s} />
          </View>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: isPro ? 20 : 12}}>
            {isPro && <SummaryCard label={t('avg_walk_time')} value={`${periodStats.avgWalkMinutes} min`} c={c} s={s} />}
            <SummaryCard label={t('current_streak')} value={String(periodStats.currentStreak)} c={c} s={s} />
            {isPro && <SummaryCard label={t('longest_streak')} value={String(periodStats.longestStreak)} c={c} s={s} />}
          </View>

          {/* Bar chart */}
          <View style={[s.card, {paddingVertical: 16, marginBottom: 16}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingHorizontal: 4}}>
              {days.map(d => {
                const h = Math.max(4, (d.totalSec / maxSec) * 80);
                return (
                  <View key={d.key} style={{alignItems: 'center', flex: 1}}>
                    <Text style={{color: c.textDim, fontSize: 10, marginBottom: 4}}>
                      {Math.floor(d.totalSec / 60)}
                    </Text>
                    <View style={{
                      width: 20,
                      height: h,
                      borderRadius: 6,
                      backgroundColor: d.goalMet ? c.accent : (isLight ? '#BFDCD6' : '#243344'),
                    }} />
                    <Text style={{color: c.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600'}}>
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Purpose Analytics (Pro only) */}
          {isPro && purposeStats.length > 0 && (
            <>
              <Text style={{color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 4}}>
                {t('purpose_analytics')}
              </Text>
              {purposeStats.map(ps => (
                <View key={ps.purpose} style={[s.card, {paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Text style={{fontSize: 16}}>{purposeIcon(ps.purpose)}</Text>
                    <Text style={{color: c.text, fontSize: 15, fontWeight: '600'}}>{purposeLabel(ps.purpose)}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={{color: c.text, fontSize: 14, fontWeight: '600'}}>{ps.totalMinutes} min</Text>
                    <Text style={{color: c.textMuted, fontSize: 12}}>
                      {ps.walks === 1 ? t('walks_count_one') : t('walks_count', String(ps.walks))}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Detailed Stats (Pro only) */}
          {isPro && filteredSessions.length > 0 && (
            <>
              <Text style={{color: c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 12}}>
                {t('detailed_stats')}
              </Text>
              <View style={[s.card, {paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
                  <Text style={{color: c.textMuted, fontSize: 14}}>{t('avg_walks_per_day')}</Text>
                  <Text style={{color: c.text, fontSize: 14, fontWeight: '600'}}>{detailedStats.avgWalksPerActiveDay}</Text>
                </View>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
                  <Text style={{color: c.textMuted, fontSize: 14}}>{t('avg_walk_time')}</Text>
                  <Text style={{color: c.text, fontSize: 14, fontWeight: '600'}}>{detailedStats.avgWalkDuration} min</Text>
                </View>
                {detailedStats.bestDayDate !== '' && (
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
                    <Text style={{color: c.textMuted, fontSize: 14}}>{t('best_day')}</Text>
                    <Text style={{color: c.text, fontSize: 14, fontWeight: '600'}}>{detailedStats.bestDayDate} ({detailedStats.bestDayMinutes} min)</Text>
                  </View>
                )}
                {detailedStats.mostUsedPurpose !== '' && (
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
                    <Text style={{color: c.textMuted, fontSize: 14}}>{t('most_used_purpose')}</Text>
                    <Text style={{color: c.text, fontSize: 14, fontWeight: '600'}}>{purposeLabel(detailedStats.mostUsedPurpose)}</Text>
                  </View>
                )}
              </View>
            </>
          )}

        </>
      )}
    </ScrollView>
  );
}

function SummaryCard({label, value, c, s}: {label: string; value: string; c: ColorSet; s: any}) {
  return (
    <View style={[s.card, {flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8}]}>
      <Text style={{color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 4}}>{value}</Text>
      <Text style={{color: c.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase'}}>{label}</Text>
    </View>
  );
}

// ── History Tab ──

function HistoryTab({sessions, isPro, onOpenPro, onDelete, onUpdate, allPurposes, c, s}: {
  sessions: WalkSession[];
  isPro: boolean;
  onOpenPro: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, u: Partial<Pick<WalkSession, 'startedAt' | 'endedAt' | 'purpose'>>) => void;
  allPurposes: string[];
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const [editSess, setEditSess] = useState<WalkSession | null>(null);
  const [editYear, setEditYear] = useState('');
  const [editMonth, setEditMonth] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editPurpose, setEditPurpose] = useState('');

  const openEdit = useCallback((sess: WalkSession) => {
    const d = new Date(sess.startedAt);
    setEditYear(String(d.getFullYear()));
    setEditMonth(String(d.getMonth() + 1).padStart(2, '0'));
    setEditDay(String(d.getDate()).padStart(2, '0'));
    setEditHour(String(d.getHours()).padStart(2, '0'));
    setEditMin(String(d.getMinutes()).padStart(2, '0'));
    setEditPurpose(sess.purpose);
    setEditSess(sess);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editSess) return;
    const y = parseInt(editYear, 10);
    const mo = parseInt(editMonth, 10) - 1;
    const dy = parseInt(editDay, 10);
    const hr = parseInt(editHour, 10);
    const mi = parseInt(editMin, 10);
    if (isNaN(y) || isNaN(mo) || isNaN(dy) || isNaN(hr) || isNaN(mi)) return;
    const oldStart = new Date(editSess.startedAt);
    const oldEnd = new Date(editSess.endedAt);
    const diffMs = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date(y, mo, dy, hr, mi, oldStart.getSeconds());
    const newEnd = new Date(newStart.getTime() + diffMs);
    onUpdate(editSess.id, {
      startedAt: newStart.toISOString(),
      endedAt: newEnd.toISOString(),
      purpose: editPurpose,
    });
    setEditSess(null);
  }, [editSess, editYear, editMonth, editDay, editHour, editMin, editPurpose, onUpdate]);

  const visibleSessions = useMemo(() => {
    const list = isPro ? sessions : sessions.filter(sess => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return new Date(sess.endedAt) >= cutoff;
    });
    return [...list].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, isPro]);

  const hasOlderData = useMemo(() => {
    if (isPro) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return sessions.some(sess => new Date(sess.endedAt) < cutoff);
  }, [sessions, isPro]);

  if (sessions.length === 0) {
    return (
      <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
        <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginBottom: 20}}>
          {t('tab_history')}
        </Text>
        <View style={{alignItems: 'center', marginTop: 40}}>
          <Text style={{color: c.text, fontSize: 17, fontWeight: '600', marginBottom: 8}}>{t('history_empty')}</Text>
          <Text style={{color: c.textDim, fontSize: 14, textAlign: 'center'}}>{t('history_empty_body')}</Text>
        </View>
      </ScrollView>
    );
  }

  const isLight = c.bg === LightColors.bg;
  const inputStyle = {
    color: c.text, fontSize: 15, fontVariant: ['tabular-nums'] as any,
    borderBottomWidth: 1, borderBottomColor: c.cardBorder,
    textAlign: 'center' as const, paddingVertical: 4, minWidth: 36,
  };

  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
      <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginBottom: 20}}>
        {t('tab_history')}
      </Text>

      {visibleSessions.map(sess => {
        const st = new Date(sess.startedAt);
        const dateStr = `${st.getFullYear()}/${st.getMonth() + 1}/${st.getDate()}`;
        const hh = String(st.getHours()).padStart(2, '0');
        const mm = String(st.getMinutes()).padStart(2, '0');
        const min = Math.floor(sess.durationSeconds / 60);

        return (
          <View key={sess.id} style={[s.card, {paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8}]}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
              <Text style={{color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums']}}>{dateStr}  {hh}:{mm}</Text>
              <View style={{flex: 1}} />
              <Pressable onPress={() => openEdit(sess)} style={{paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: c.accent, marginRight: 6}}>
                <Text style={{color: c.accent, fontSize: 11, fontWeight: '600'}}>{t('edit_btn')}</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert(t('delete'), t('delete_confirm'), [{text: t('cancel'), style: 'cancel'}, {text: t('delete'), style: 'destructive', onPress: () => onDelete(sess.id)}])} style={{paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: c.danger}}>
                <Text style={{color: c.danger, fontSize: 11, fontWeight: '600'}}>{t('delete')}</Text>
              </Pressable>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={{fontSize: 14, marginRight: 6}}>{purposeIcon(sess.purpose)}</Text>
              <Text style={{color: c.text, fontSize: 14, fontWeight: '600', flex: 1}}>{purposeLabel(sess.purpose)}</Text>
              <Text style={{color: c.textMuted, fontSize: 13}}>{min} min</Text>
            </View>
            {sess.note && (
              <Text style={{color: c.textDim, fontSize: 12, marginTop: 6, fontStyle: 'italic'}}>
                "{sess.note}"
              </Text>
            )}
          </View>
        );
      })}

      {!isPro && hasOlderData && (
        <View style={[s.card, {alignItems: 'center', paddingVertical: 20, marginTop: 8}]}>
          <Text style={{color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8}}>
            {t('unlock_full_history')}
          </Text>
          <Text style={{color: c.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20}}>
            {t('unlock_full_history_body')}
          </Text>
          <Pressable
            style={({pressed}) => [s.button, {marginTop: 0, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32}, pressed && s.buttonPressed]}
            onPress={onOpenPro}>
            <Text style={s.buttonText}>{t('unlock_pro')}</Text>
          </Pressable>
        </View>
      )}

      {/* Edit Modal */}
      {editSess && (
        <View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20}}>
          <View style={{backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.cardBorder}}>
            <Text style={{color: c.text, fontSize: 17, fontWeight: '700', marginBottom: 16}}>{t('edit_session')}</Text>

            {/* Date row */}
            <Text style={{color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6}}>{t('edit_date')}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16}}>
              <TextInput style={[inputStyle, {minWidth: 50}]} value={editYear} onChangeText={setEditYear} keyboardType="number-pad" maxLength={4} />
              <Text style={{color: c.textMuted, fontSize: 15}}>/</Text>
              <TextInput style={inputStyle} value={editMonth} onChangeText={setEditMonth} keyboardType="number-pad" maxLength={2} />
              <Text style={{color: c.textMuted, fontSize: 15}}>/</Text>
              <TextInput style={inputStyle} value={editDay} onChangeText={setEditDay} keyboardType="number-pad" maxLength={2} />
            </View>

            {/* Time row */}
            <Text style={{color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6}}>{t('edit_time')}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16}}>
              <TextInput style={inputStyle} value={editHour} onChangeText={setEditHour} keyboardType="number-pad" maxLength={2} />
              <Text style={{color: c.textMuted, fontSize: 15}}>:</Text>
              <TextInput style={inputStyle} value={editMin} onChangeText={setEditMin} keyboardType="number-pad" maxLength={2} />
            </View>

            {/* Purpose selector */}
            <Text style={{color: c.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6}}>{t('edit_purpose')}</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
              {allPurposes.map(p => {
                const active = p === editPurpose;
                return (
                  <Pressable key={p} onPress={() => setEditPurpose(p)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                    borderWidth: 1, borderColor: active ? c.accent : c.cardBorder,
                    backgroundColor: active ? c.accentDark : 'transparent',
                  }}>
                    <Text style={{fontSize: 13}}>{purposeIcon(p)}</Text>
                    <Text style={{fontSize: 13, fontWeight: '600', color: active ? c.accent : c.textMuted}}>{purposeLabel(p)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Buttons */}
            <View style={{flexDirection: 'row', gap: 10}}>
              <Pressable onPress={() => setEditSess(null)} style={{flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center'}}>
                <Text style={{color: c.textMuted, fontWeight: '600'}}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={{flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center'}}>
                <Text style={{color: '#fff', fontWeight: '600'}}>{t('save_btn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ── Settings Tab ──

function SettingsTab({
  dailyGoal, onDailyGoalChange,
  goalNotifEnabled, onGoalNotifChange,
  reminderEnabled, onReminderChange,
  reminderTime, onReminderTimeChange,
  customPurposes, onCustomPurposesChange,
  themeMode, onThemeChange,
  isPro, onOpenPro,
  onOpenLanguage, onOpenPrivacy, onReset,
  c, s,
}: {
  dailyGoal: number;
  onDailyGoalChange: (v: number) => void;
  goalNotifEnabled: boolean;
  onGoalNotifChange: (v: boolean) => void;
  reminderEnabled: boolean;
  onReminderChange: (v: boolean) => void;
  reminderTime: string;
  onReminderTimeChange: (v: string) => void;
  customPurposes: string[];
  onCustomPurposesChange: (v: string[]) => void;
  themeMode: ThemeMode;
  onThemeChange: (v: ThemeMode) => void;
  isPro: boolean;
  onOpenPro: () => void;
  onOpenLanguage: () => void;
  onOpenPrivacy: () => void;
  onReset: () => void;
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const [newPurpose, setNewPurpose] = useState('');
  const [reminderHour, setReminderHour] = useState(reminderTime.split(':')[0]);
  const [reminderMin, setReminderMin] = useState(reminderTime.split(':')[1]);
  const [customGoalText, setCustomGoalText] = useState('');
  const [showCustomGoal, setShowCustomGoal] = useState(false);

  const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];
  const isCustomGoal = !GOAL_OPTIONS.includes(dailyGoal);

  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 20, paddingTop: 54}} contentContainerStyle={{paddingBottom: 40}}>
      <Text style={{color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginBottom: 20}}>
        {t('settings_title')}
      </Text>

      {/* Pro Section */}
      <Text style={s.settingsLabel}>{t('pro_section')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <Pressable style={[s.settingsRow, {borderBottomWidth: 0}]} onPress={onOpenPro}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text style={s.settingsRowText}>{t('walk_intent_pro')}</Text>
            {isPro && (
              <View style={s.proBadge}>
                <Text style={s.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <Text style={{color: isPro ? c.accent : c.textMuted, fontSize: 14}}>
              {isPro ? t('pro_status_active') : t('pro_status_free')}
            </Text>
            <Text style={s.settingsRowArrow}>›</Text>
          </View>
        </Pressable>
      </View>

      {/* Daily Goal */}
      <Text style={s.settingsLabel}>{t('daily_goal')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <View style={s.goalOptions}>
          {GOAL_OPTIONS.map(opt => (
            <Pressable
              key={opt}
              style={[s.goalOption, opt === dailyGoal && !isCustomGoal && s.goalOptionActive]}
              onPress={() => { onDailyGoalChange(opt); setShowCustomGoal(false); }}>
              <Text style={[s.goalOptionText, opt === dailyGoal && !isCustomGoal && s.goalOptionTextActive]}>
                {opt} min
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[s.goalOption, (showCustomGoal || isCustomGoal) && s.goalOptionActive]}
            onPress={() => {
              if (!isPro) { onOpenPro(); return; }
              setShowCustomGoal(true);
              setCustomGoalText(isCustomGoal ? String(dailyGoal) : '');
            }}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Text style={[s.goalOptionText, (showCustomGoal || isCustomGoal) && s.goalOptionTextActive]}>
                {isCustomGoal ? `${dailyGoal} min` : t('custom_goal')}
              </Text>
              {!isPro && (
                <View style={s.proBadge}>
                  <Text style={s.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
        {showCustomGoal && isPro && (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12}}>
            <TextInput
              style={[s.customHHMMInput, {width: 70, textAlign: 'center'}]}
              value={customGoalText}
              onChangeText={v => setCustomGoalText(v.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="min"
              placeholderTextColor={c.textDim}
              maxLength={3}
            />
            <Text style={{color: c.textMuted, fontSize: 13}}>{t('custom_goal_hint')}</Text>
            <Pressable
              style={s.customInputBtn}
              onPress={() => {
                const val = Number(customGoalText);
                if (val >= 5 && val <= 180) {
                  onDailyGoalChange(val);
                  setShowCustomGoal(false);
                }
              }}>
              <Text style={s.customInputBtnText}>OK</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Goal Notification */}
      <Text style={s.settingsLabel}>{t('goal_notification')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <View style={s.settingsToggleRow}>
          <View>
            <Text style={s.settingsRowText}>{t('goal_notification')}</Text>
            <Text style={s.settingsHint}>{t('goal_notif_desc')}</Text>
          </View>
          <Toggle
            value={goalNotifEnabled}
            onValueChange={onGoalNotifChange}
            trackOn={c.switchTrackOn}
            trackOff={c.switchTrackOff}
            thumb={c.switchThumb}
          />
        </View>
      </View>

      {/* Daily Reminder */}
      <Text style={s.settingsLabel}>{t('daily_reminder')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <View style={s.settingsToggleRow}>
          <View>
            <Text style={s.settingsRowText}>{t('daily_reminder')}</Text>
            <Text style={s.settingsHint}>{t('reminder_desc')}</Text>
          </View>
          <Toggle
            value={reminderEnabled}
            onValueChange={onReminderChange}
            trackOn={c.switchTrackOn}
            trackOff={c.switchTrackOff}
            thumb={c.switchThumb}
          />
        </View>
        {reminderEnabled && (
          <View style={{marginTop: 12}}>
            <Text style={{color: c.textMuted, fontSize: 13, marginBottom: 6}}>{t('reminder_time')}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <TextInput
                style={s.customHHMMInput}
                value={reminderHour}
                onChangeText={v => {
                  setReminderHour(v.replace(/\D/g, '').slice(0, 2));
                }}
                onBlur={() => {
                  const h = Math.min(23, Math.max(0, Number(reminderHour) || 0));
                  const hStr = String(h).padStart(2, '0');
                  setReminderHour(hStr);
                  onReminderTimeChange(`${hStr}:${reminderMin}`);
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={s.customHHMMLabel}>:</Text>
              <TextInput
                style={s.customHHMMInput}
                value={reminderMin}
                onChangeText={v => {
                  setReminderMin(v.replace(/\D/g, '').slice(0, 2));
                }}
                onBlur={() => {
                  const m = Math.min(59, Math.max(0, Number(reminderMin) || 0));
                  const mStr = String(m).padStart(2, '0');
                  setReminderMin(mStr);
                  onReminderTimeChange(`${reminderHour}:${mStr}`);
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
        )}
      </View>

      {/* Purposes */}
      <Text style={s.settingsLabel}>{t('purposes_settings')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        {DEFAULT_PURPOSES.map(p => (
          <View key={p} style={[s.settingsRow, {borderBottomWidth: 0}]}>
            <Text style={s.settingsRowText}>{purposeIcon(p)}  {purposeLabel(p)}</Text>
          </View>
        ))}
        {customPurposes.map((p, i) => (
          <View key={p} style={[s.settingsRow, {borderBottomWidth: 0}]}>
            <Text style={s.settingsRowText}>•  {p}</Text>
            <Pressable onPress={() => {
              const updated = customPurposes.filter((_, j) => j !== i);
              onCustomPurposesChange(updated);
            }}>
              <Text style={{color: c.danger, fontSize: 14}}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
          <TextInput
            style={[s.customHHMMInput, {flex: 1, width: undefined, textAlign: 'left', paddingHorizontal: 12}]}
            placeholder={t('add_purpose_placeholder')}
            placeholderTextColor={c.textDim}
            value={newPurpose}
            onChangeText={setNewPurpose}
          />
          <Pressable
            style={s.customInputBtn}
            onPress={() => {
              const trimmed = newPurpose.trim();
              if (trimmed && !customPurposes.includes(trimmed)) {
                onCustomPurposesChange([...customPurposes, trimmed]);
                setNewPurpose('');
              }
            }}>
            <Text style={s.customInputBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Appearance */}
      <Text style={s.settingsLabel}>{t('appearance')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <View style={s.goalOptions}>
          {(['light', 'dark', 'system'] as ThemeMode[]).map(m => (
            <Pressable
              key={m}
              style={[s.goalOption, m === themeMode && s.goalOptionActive]}
              onPress={() => onThemeChange(m)}>
              <Text style={[s.goalOptionText, m === themeMode && s.goalOptionTextActive]}>
                {t(`theme_${m}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Other */}
      <Text style={s.settingsLabel}>{t('tab_settings')}</Text>
      <View style={[s.card, {marginBottom: 16}]}>
        <Pressable style={[s.settingsRow, s.settingsRowBorder]} onPress={onOpenLanguage}>
          <Text style={s.settingsRowText}>{t('language')}</Text>
          <Text style={s.settingsRowArrow}>›</Text>
        </Pressable>
        <Pressable style={[s.settingsRow, s.settingsRowBorder]} onPress={onOpenPrivacy}>
          <Text style={s.settingsRowText}>{t('privacy_policy')}</Text>
          <Text style={s.settingsRowArrow}>›</Text>
        </Pressable>
        <Pressable
          style={s.settingsRow}
          onPress={() => {
            Alert.alert(
              t('reset_confirm_title'),
              t('reset_confirm_body'),
              [
                {text: t('cancel'), style: 'cancel'},
                {text: t('reset_btn'), style: 'destructive', onPress: onReset},
              ],
            );
          }}>
          <Text style={[s.settingsRowText, {color: c.danger}]}>{t('reset_data')}</Text>
        </Pressable>
      </View>

      <Text style={s.versionText}>{t('version_label', '1.0.0')}</Text>
    </ScrollView>
  );
}

// ── Pro Upgrade Screen ──

function ProUpgradeScreen({isPro, onPurchase, onRestore, c, s}: {
  isPro: boolean;
  onPurchase: () => void;
  onRestore: () => void;
  c: ColorSet;
  s: ReturnType<typeof createStyles>;
}) {
  const benefits = [
    {icon: '☰', text: t('pro_benefit_history')},
    {icon: '◉', text: t('pro_benefit_stats')},
    {icon: '◎', text: t('pro_benefit_purpose')},
    {icon: '✎', text: t('pro_benefit_goal')},
  ];

  return (
    <ScrollView style={{flex: 1, paddingHorizontal: 24}} contentContainerStyle={{alignItems: 'center', paddingTop: 32, paddingBottom: 40}}>
      <Text style={{color: c.text, fontSize: 28, fontWeight: '800', marginBottom: 8}}>
        {t('pro_title')}
      </Text>
      <Text style={{color: c.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22}}>
        {t('pro_subtitle')}
      </Text>

      <View style={{width: '100%', marginBottom: 32}}>
        {benefits.map(b => (
          <View key={b.text} style={{flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12}}>
            <View style={{width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentDark, justifyContent: 'center', alignItems: 'center'}}>
              <Text style={{color: c.accent, fontSize: 16}}>{b.icon}</Text>
            </View>
            <Text style={{color: c.text, fontSize: 16, fontWeight: '600', flex: 1}}>{b.text}</Text>
          </View>
        ))}
      </View>

      <Text style={{color: c.textMuted, fontSize: 14, marginBottom: 4}}>{t('pro_pricing')}</Text>
      <Text style={{color: c.textDim, fontSize: 13, marginBottom: 24}}>{t('pro_no_sub')}</Text>

      {isPro ? (
        <View style={{backgroundColor: c.accentDark, borderRadius: 14, borderWidth: 1, borderColor: c.accent, paddingVertical: 14, paddingHorizontal: 40}}>
          <Text style={{color: c.accent, fontSize: 16, fontWeight: '700'}}>{t('pro_active')}</Text>
        </View>
      ) : (
        <>
          <Pressable
            style={({pressed}) => [s.button, {alignSelf: 'stretch', borderRadius: 16, paddingVertical: 16}, pressed && s.buttonPressed]}
            onPress={onPurchase}>
            <Text style={s.buttonText}>{t('unlock_pro')}</Text>
          </Pressable>
          <Pressable
            style={{marginTop: 16, paddingVertical: 10}}
            onPress={onRestore}>
            <Text style={{color: c.textMuted, fontSize: 14, fontWeight: '600'}}>{t('restore_purchases')}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
