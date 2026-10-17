import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
} from '@notifee/react-native';

const CHANNEL_ID = 'walk-notif';
const GOAL_NOTIF_ID = 'walk-goal-complete';
const REMINDER_NOTIF_ID = 'walk-daily-reminder';

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Walk Intent',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

export async function showGoalNotification(
  totalMinutes: number,
): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: GOAL_NOTIF_ID,
    title: 'Daily goal complete',
    body: `You walked for ${totalMinutes} minutes today.`,
    android: {channelId: CHANNEL_ID, pressAction: {id: 'default'}},
  });
}

export async function scheduleDailyReminder(
  fireDate: number,
  remainingMinutes: number,
): Promise<void> {
  if (fireDate <= Date.now()) return;
  await ensureChannel();
  await cancelDailyReminder();
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fireDate,
    alarmManager: {allowWhileIdle: true},
  };
  try {
    await notifee.createTriggerNotification(
      {
        id: REMINDER_NOTIF_ID,
        title: 'Ready for a walk?',
        body: `You still have ${remainingMinutes} minutes left to reach today's goal.`,
        android: {channelId: CHANNEL_ID, pressAction: {id: 'default'}},
      },
      trigger,
    );
  } catch {}
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await notifee.cancelNotification(REMINDER_NOTIF_ID);
  } catch {}
}

export async function openNotificationSettings(): Promise<void> {
  await notifee.openNotificationSettings();
}
