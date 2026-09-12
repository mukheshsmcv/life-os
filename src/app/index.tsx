import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Task, useTasks } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  ScheduledBlock,
  scheduleTasks,
} from '@/lib/scheduler';
import { getTodayString } from '@/lib/date-time';

type ScheduledActivity = Task & ScheduledBlock;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateToTime(date: Date) {
  const h = date.getHours();
  return `${h % 12 || 12}:${pad(date.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tasks, completeTask, skipTask } = useTasks();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [pausedActivity, setPausedActivity] = useState<{ id: string; pausedAt: Date } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayString();
  const todayTasks = tasks.filter((task) => task.date === todayStr || task.date == null);
  const schedule = scheduleTasks(todayTasks, DEFAULT_SCHEDULING_SETTINGS, currentTime);
  const taskById = new Map(todayTasks.map((task) => [task.id, task]));

  const scheduledActivities = schedule.blocks.flatMap((block) => {
    const task = taskById.get(block.taskId);
    return task ? [{ ...task, ...block }] : [];
  });
  const unscheduledTasks = schedule.unscheduledTaskIds.flatMap((taskId) => {
    const task = taskById.get(taskId);
    return task ? [task] : [];
  });

  const pausedActivityInSchedule = pausedActivity
    ? scheduledActivities.find((a) => a.id === pausedActivity.id)
    : undefined;
  const timedCurrentActivity = scheduledActivities.find(
    (a) => currentTime >= a.start && currentTime < a.end
  );
  const currentActivity = pausedActivityInSchedule ?? timedCurrentActivity;
  const nextActivity = scheduledActivities.find((a) => a.start > currentTime);
  const upcomingActivities = scheduledActivities.filter((a) => a.start > currentTime);
  const isCurrentActivityPaused = Boolean(pausedActivityInSchedule);
  const displayedScheduledActivity = currentActivity ?? nextActivity;
  const displayedTask = displayedScheduledActivity ?? unscheduledTasks[0];

  const progressTime = pausedActivityInSchedule ? pausedActivity!.pausedAt : currentTime;
  const progressPercent = currentActivity
    ? Math.min(
        100,
        Math.max(
          0,
          ((progressTime.getTime() - currentActivity.start.getTime()) /
            (currentActivity.end.getTime() - currentActivity.start.getTime())) *
            100
        )
      )
    : 0;

  const statusLabel = isCurrentActivityPaused
    ? 'PAUSED'
    : currentActivity
      ? 'NOW'
      : displayedScheduledActivity
        ? 'UP NEXT'
        : displayedTask
          ? 'NOT SCHEDULED'
          : 'DAY COMPLETE';

  const remainingText = isCurrentActivityPaused
    ? 'Activity paused'
    : currentActivity
      ? formatDuration(
          Math.max(0, Math.ceil((currentActivity.end.getTime() - currentTime.getTime()) / 60000))
        ) + ' remaining'
      : displayedScheduledActivity
        ? 'Starts in ' +
          formatDuration(
            Math.max(0, Math.ceil((displayedScheduledActivity.start.getTime() - currentTime.getTime()) / 60000))
          )
        : "No open time remains in today\u2019s window";

  const handleDone = () => {
    if (!currentActivity) return;
    completeTask(currentActivity.id);
    setPausedActivity(null);
  };
  const handleSkip = () => {
    if (!currentActivity) return;
    skipTask(currentActivity.id);
    setPausedActivity(null);
  };
  const handlePause = () => {
    if (!currentActivity) return;
    setPausedActivity((a) =>
      a?.id === currentActivity.id ? null : { id: currentActivity.id, pausedAt: currentTime }
    );
  };

  const dayCompletePendingCount = todayTasks.filter((t) => t.status === 'pending').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>Mukhesh</Text>
          </View>
          <View style={styles.profileCircle}>
            <Text style={styles.profileText}>M</Text>
          </View>
        </View>

        {/* ─── NOW Card ─── */}
        <View style={styles.nowCard}>
          <Text style={styles.nowLabel}>{statusLabel}</Text>
          <Text style={styles.currentTask}>{displayedTask?.title ?? 'Day complete'}</Text>

          {displayedTask ? (
            <>
              {displayedScheduledActivity ? (
                <>
                  <Text style={styles.timeText}>
                    {dateToTime(displayedScheduledActivity.start)} —{' '}
                    {dateToTime(displayedScheduledActivity.end)}
                  </Text>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${progressPercent}%` as DimensionValue },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.timeText}>
                  Not scheduled · {displayedTask.durationMinutes} min
                </Text>
              )}

              <Text style={styles.remaining}>{remainingText}</Text>

              {currentActivity && (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionDone}
                    onPress={handleDone}
                    accessibilityRole="button"
                    accessibilityLabel="Mark current task done">
                    <Text style={styles.actionDoneText}>Done</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionSecondary}
                    onPress={handlePause}
                    accessibilityRole="button"
                    accessibilityLabel={isCurrentActivityPaused ? 'Resume task' : 'Pause task'}>
                    <Text style={styles.actionSecondaryText}>
                      {isCurrentActivityPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionSecondary}
                    onPress={handleSkip}
                    accessibilityRole="button"
                    accessibilityLabel="Skip current task">
                    <Text style={styles.actionSecondaryText}>Can't do this</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.remaining}>
              {dayCompletePendingCount === 0
                ? 'All tasks complete. Great work.'
                : 'No more activities today.'}
            </Text>
          )}
        </View>

        {/* ─── Ask Life OS ─── */}
        <Pressable
          style={styles.askButton}
          onPress={() => router.push('/chat')}
          accessibilityRole="button"
          accessibilityLabel="Ask Life OS">
          <View style={styles.askLeft}>
            <Text style={styles.askIcon}>✦</Text>
            <View>
              <Text style={styles.askTitle}>Ask Life OS…</Text>
              <Text style={styles.askSubtitle}>Tell me what you want to get done</Text>
            </View>
          </View>
          <Text style={styles.askArrow}>›</Text>
        </Pressable>

        {/* ─── Suggested prompts ─── */}
        <View style={styles.promptsRow}>
          {['What should I do now?', 'Replan my evening', 'Find 2h free'].map((p) => (
            <Pressable
              key={p}
              style={styles.promptChip}
              onPress={() => router.push('/chat')}
              accessibilityRole="button"
              accessibilityLabel={`Ask Life OS: ${p}`}>
              <Text style={styles.promptChipText}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Up Next ─── */}
        {upcomingActivities.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Up next</Text>
            </View>
            {upcomingActivities.map((activity) => (
              <ScheduleItem
                key={activity.id}
                start={activity.start}
                end={activity.end}
                title={activity.title}
                duration={activity.durationMinutes}
                status={activity.status}
              />
            ))}
          </>
        )}

        {/* ─── Not scheduled ─── */}
        {unscheduledTasks.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Text style={styles.sectionTitle}>Not scheduled today</Text>
            </View>
            {unscheduledTasks.map((task) => (
              <ScheduleItem
                key={task.id}
                title={task.title}
                duration={task.durationMinutes}
                status={task.status}
                timeLabel="Not scheduled"
              />
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Schedule Item ────────────────────────────────────────────────────────────

function ScheduleItem({
  start,
  end,
  title,
  duration,
  status,
  timeLabel,
}: {
  start?: Date;
  end?: Date;
  title: string;
  duration: number;
  status?: string;
  timeLabel?: string;
}) {
  const isDone = status && status !== 'pending';
  return (
    <View style={[itemStyles.row, isDone && itemStyles.rowDone]}>
      <Text style={itemStyles.time}>
        {timeLabel ?? (start && end ? `${dateToTime(start)} — ${dateToTime(end)}` : '')}
      </Text>
      <View style={itemStyles.line} />
      <View style={itemStyles.content}>
        <Text style={[itemStyles.title, isDone && itemStyles.titleDone]}>{title}</Text>
        <Text style={itemStyles.duration}>
          {formatDuration(duration)}
          {isDone ? ` · ${status}` : ''}
        </Text>
      </View>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowDone: { opacity: 0.45 },
  time: { width: 76, color: '#737983', fontSize: 12, fontWeight: '500' },
  line: { width: 2, height: 36, backgroundColor: '#252932', marginRight: 14 },
  content: {
    flex: 1,
    backgroundColor: '#14171C',
    padding: 13,
    borderRadius: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#E8E9EC', fontSize: 14, fontWeight: '600', flex: 1 },
  titleDone: { color: '#4A5060', textDecorationLine: 'line-through' },
  duration: { color: '#737983', fontSize: 12 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  content: { paddingHorizontal: 20, paddingBottom: 30 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  greeting: { color: '#737983', fontSize: 14 },
  name: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 2 },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#252932',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },

  // NOW card
  nowCard: {
    backgroundColor: '#171A20',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#252932',
  },
  nowLabel: {
    color: '#A7A0FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  currentTask: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', lineHeight: 30 },
  timeText: { color: '#9A9EA6', fontSize: 14, marginTop: 8 },
  progressBg: {
    height: 4,
    backgroundColor: '#252932',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: '#A7A0FF', borderRadius: 2 },
  remaining: { color: '#737983', fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  actionDone: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionDoneText: { color: '#0B0D10', fontWeight: '700', fontSize: 14 },
  actionSecondary: {
    backgroundColor: '#252932',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionSecondaryText: { color: '#D2D5DA', fontWeight: '600', fontSize: 14 },

  // Ask Life OS
  askButton: {
    backgroundColor: '#171A20',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#252932',
  },
  askLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  askIcon: { color: '#A7A0FF', fontSize: 22 },
  askTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  askSubtitle: { color: '#737983', fontSize: 12, marginTop: 2 },
  askArrow: { color: '#4A5060', fontSize: 24 },

  // Prompt chips
  promptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  promptChip: {
    backgroundColor: '#0F1115',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#1E2228',
  },
  promptChipText: { color: '#737983', fontSize: 12, fontWeight: '500' },

  // Up Next section
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
