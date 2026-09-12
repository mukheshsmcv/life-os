import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';

import { Task, useTasks } from '@/contexts/tasks-context';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  ScheduledBlock,
  scheduleTasks,
} from '@/lib/scheduler';
import { getTodayString } from '@/lib/date-time';

type ScheduledActivity = Task & ScheduledBlock;

function dateToTime(date: Date) {
  const hours = date.getHours();
  return (
    String(hours % 12 || 12) +
    ':' +
    String(date.getMinutes()).padStart(2, '0') +
    ' ' +
    (hours >= 12 ? 'PM' : 'AM')
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return String(minutes) + 'm';
  return minutes % 60 === 0
    ? String(Math.floor(minutes / 60)) + 'h'
    : String(Math.floor(minutes / 60)) + 'h ' + String(minutes % 60) + 'm';
}

export default function HomeScreen() {
  const router = useRouter();
  const { tasks, completeTask, skipTask } = useTasks();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [pausedActivity, setPausedActivity] = useState<{ id: string; pausedAt: Date } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayString();
  // Today shows:
  //   1. Tasks explicitly pinned to today (date === todayStr)
  //   2. Undated tasks (date == null) — the scheduler decides their slot; scheduling does NOT assign them a date.
  // Tasks explicitly pinned to a different date are excluded.
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
    ? scheduledActivities.find((activity) => activity.id === pausedActivity.id)
    : undefined;
  const timedCurrentActivity = scheduledActivities.find(
    (activity) => currentTime >= activity.start && currentTime < activity.end
  );
  const currentActivity = pausedActivityInSchedule ?? timedCurrentActivity;
  const nextActivity = scheduledActivities.find((activity) => activity.start > currentTime);
  const upcomingActivities = scheduledActivities.filter((activity) => activity.start > currentTime);
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
    setPausedActivity((activity) =>
      activity?.id === currentActivity.id ? null : { id: currentActivity.id, pausedAt: currentTime }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good evening</Text>
            <Text style={styles.name}>Mukhesh</Text>
          </View>
          <View style={styles.profileCircle}><Text style={styles.profileText}>M</Text></View>
        </View>

        <View style={styles.nowCard}>
          <Text style={styles.nowLabel}>
            {isCurrentActivityPaused
              ? 'PAUSED'
              : currentActivity
                ? 'NOW'
                : displayedScheduledActivity
                  ? 'UP NEXT'
                  : displayedTask
                    ? 'NOT SCHEDULED'
                    : 'DAY COMPLETE'}
          </Text>
          <Text style={styles.currentTask}>{displayedTask?.title ?? 'Day complete'}</Text>
          {displayedTask ? (
            <>
              {displayedScheduledActivity ? (
                <>
                  <Text style={styles.time}>
                    {dateToTime(displayedScheduledActivity.start)} — {dateToTime(displayedScheduledActivity.end)}
                  </Text>
                  <View style={styles.progressBackground}>
                    <View
                      style={[
                        styles.progress,
                        { width: (String(progressPercent) + '%') as DimensionValue },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.time}>Not scheduled today · {displayedTask.durationMinutes} min</Text>
              )}
              <Text style={styles.remaining}>
                {isCurrentActivityPaused
                  ? 'Activity paused'
                  : currentActivity
                    ? formatDuration(Math.max(0, Math.ceil((currentActivity.end.getTime() - currentTime.getTime()) / 60000))) + ' remaining'
                    : displayedScheduledActivity
                      ? 'Starts in ' + formatDuration(Math.max(0, Math.ceil((displayedScheduledActivity.start.getTime() - currentTime.getTime()) / 60000)))
                      : 'No open time remains in today’s planning window'}
              </Text>
              {currentActivity && (
                <View style={styles.actions}>
                  <Pressable style={styles.actionButton} onPress={handleDone}><Text style={styles.actionText}>Done</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handlePause}><Text style={styles.secondaryText}>{isCurrentActivityPaused ? 'Resume' : 'Pause'}</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handleSkip}><Text style={styles.secondaryText}>Can't do this</Text></Pressable>
                </View>
              )}
            </>
          ) : <Text style={styles.remaining}>No more activities today</Text>}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Up next</Text></View>
        {upcomingActivities.map((activity) => (
          <ScheduleItem key={activity.id} start={activity.start} end={activity.end} title={activity.title} duration={activity.durationMinutes} />
        ))}
        {unscheduledTasks.length > 0 && (
          <>
            <View style={styles.unscheduledHeader}>
              <Text style={styles.sectionTitle}>Not scheduled today</Text>
            </View>
            {unscheduledTasks.map((task) => (
              <ScheduleItem
                key={task.id}
                title={task.title}
                duration={task.durationMinutes}
                timeLabel="Not scheduled"
              />
            ))}
          </>
        )}
        <Pressable style={styles.aiButton} onPress={() => router.push('/chat')}>
          <Text style={styles.aiIcon}>✦</Text>
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>What should I do now?</Text>
            <Text style={styles.aiSubtitle}>Ask your AI planner</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScheduleItem({ start, end, title, duration, timeLabel }: {
  start?: Date; end?: Date; title: string; duration: number; timeLabel?: string;
}) {
  return (
    <View style={styles.scheduleItem}>
      <Text style={styles.itemTime}>{timeLabel ?? (start && end ? dateToTime(start) + ' — ' + dateToTime(end) : '')}</Text>
      <View style={styles.itemLine} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDuration}>{duration} min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  content: { padding: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  greeting: { color: '#8D929A', fontSize: 15 },
  name: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 3 },
  profileCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#252932', justifyContent: 'center', alignItems: 'center' },
  profileText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  nowCard: { backgroundColor: '#171A20', borderRadius: 24, padding: 22, marginBottom: 30 },
  nowLabel: { color: '#A7A0FF', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  currentTask: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  time: { color: '#9A9EA6', fontSize: 15, marginTop: 8 },
  progressBackground: { height: 5, backgroundColor: '#292D35', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: '#A7A0FF', borderRadius: 3 },
  remaining: { color: '#777D87', fontSize: 13, marginTop: 9 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  actionButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  actionText: { color: '#0B0D10', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#252932', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  secondaryText: { color: '#D2D5DA', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  unscheduledHeader: { marginTop: 10, marginBottom: 15 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  itemTime: { width: 70, color: '#858A94', fontSize: 13 },
  itemLine: { width: 2, height: 35, backgroundColor: '#30343C', marginRight: 15 },
  itemContent: { flex: 1, backgroundColor: '#14171C', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  itemDuration: { color: '#737983', fontSize: 13 },
  aiButton: { marginTop: 15, backgroundColor: '#202329', borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center' },
  aiIcon: { color: '#A7A0FF', fontSize: 25, marginRight: 13 },
  aiTextContainer: { flex: 1 },
  aiTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  aiSubtitle: { color: '#777D87', fontSize: 12, marginTop: 3 },
  arrow: { color: '#9A9EA6', fontSize: 27 },
});
