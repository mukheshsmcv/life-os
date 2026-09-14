import { usePathname, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';

import { SuggestionChip } from '@/components/SuggestionChip';
import { Task, useTasks } from '@/contexts/tasks-context';
import { getTodayString } from '@/lib/date-time';
import { determineTodayFocus } from '@/lib/focus-engine';
import {
  DEFAULT_SCHEDULING_SETTINGS,
  ScheduledBlock,
  ScheduleResult,
  scheduleTasks,
} from '@/lib/scheduler';

type ScheduledActivity = Task & ScheduledBlock;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${period}`;
}

function formatDuration(minutes: number): string {
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

const SUGGESTIONS = [
  'Plan my day for high focus',
  'Reschedule missed tasks',
  'Add 30 min workout today',
  'What is on my schedule?',
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tasks, getEventsForDate, completeTask, skipTask } = useTasks();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [pausedActivity, setPausedActivity] = useState<{ id: string; pausedAt: Date } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayString();
  const todayEvents = getEventsForDate(todayStr);

  const schedulerEvents = todayEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startMinute: e.startMinute,
    endMinute: e.endMinute,
  }));

  const focus = determineTodayFocus({
    tasks,
    events: schedulerEvents,
    currentDate: currentTime,
    pausedActivityId: pausedActivity?.id ?? null,
  });

  const nowItem = focus.nowItem;
  const isCurrentActivityPaused = focus.isPaused;
  const nowLabel = isCurrentActivityPaused
    ? 'PAUSED'
    : focus.stateKind === 'active_now'
    ? 'NOW'
    : focus.stateKind === 'available_now'
    ? 'NOW'
    : focus.stateKind === 'waiting_upcoming'
    ? 'UP NEXT'
    : nowItem
    ? 'NOT SCHEDULED'
    : 'DAY COMPLETE';

  const displayedItem = nowItem ?? focus.upNextItems[0];
  const displayedTitle = displayedItem?.title ?? 'Day complete';
  const progressTime = pausedActivity ? pausedActivity.pausedAt : currentTime;

  const progressPercent = displayedItem
    ? Math.min(
        100,
        Math.max(
          0,
          ((progressTime.getTime() - displayedItem.start.getTime()) /
            (displayedItem.end.getTime() - displayedItem.start.getTime())) *
            100
        )
      )
    : 0;

  const handleDone = () => {
    if (!nowItem || nowItem.kind !== 'task') return;
    completeTask(nowItem.id);
    setPausedActivity(null);
  };

  const handleSkip = () => {
    if (!nowItem || nowItem.kind !== 'task') return;
    skipTask(nowItem.id);
    setPausedActivity(null);
  };

  const handlePause = () => {
    if (!nowItem || nowItem.kind !== 'task') return;
    setPausedActivity((activity) =>
      activity?.id === nowItem.id ? null : { id: nowItem.id, pausedAt: currentTime }
    );
  };

  const handleChipPress = (prompt: string) => {
    router.push({
      pathname: '/chat',
      params: { initialPrompt: prompt },
    });
  };

  // ─── Horizontal swipe gesture → Calendar ──────────────────────────────────
  const hasNavigatedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const checkSwipeAndNavigate = (
    translationX: number,
    translationY: number,
    absoluteX?: number,
    absoluteY?: number
  ) => {
    const startX = startXRef.current;
    const startY = startYRef.current;
    const totalDx = absoluteX !== undefined && startX > 0 ? absoluteX - startX : translationX;
    const totalDy = absoluteY !== undefined && startY > 0 ? absoluteY - startY : translationY;

    const dx = Math.max(translationX, totalDx);
    const absDy = Math.max(Math.abs(translationY), Math.abs(totalDy));

    const isPositiveSwipe = dx > 0;
    const hasMinDistance = dx >= 60;
    const isClearlyHorizontal = dx > absDy * 1.4;

    if (hasNavigatedRef.current) return;

    if (isPositiveSwipe && hasMinDistance && isClearlyHorizontal) {
      hasNavigatedRef.current = true;
      router.push('/calendar');
    }
  };

  const swipeToCalendarGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((event) => {
      hasNavigatedRef.current = false;
      startXRef.current = event.absoluteX;
      startYRef.current = event.absoluteY;
    })
    .onUpdate((event) => {
      checkSwipeAndNavigate(
        event.translationX,
        event.translationY,
        event.absoluteX,
        event.absoluteY
      );
    })
    .onEnd((event) => {
      checkSwipeAndNavigate(
        event.translationX,
        event.translationY,
        event.absoluteX,
        event.absoluteY
      );
    });

  return (
    <GestureDetector gesture={swipeToCalendarGesture}>
      <View
        collapsable={false}
        style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          <Pressable 
            onPress={() => router.push('/calendar')} 
            style={styles.calendarIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Open Calendar">
            <SymbolView name="calendar" style={{ width: 24, height: 24 }} tintColor="#A7A0FF" />
          </Pressable>
        </View>


        {/* ─── NOW Card ─── */}
        <View style={styles.nowCard}>
          <Text style={styles.nowLabel}>{nowLabel}</Text>
          <Text style={styles.currentTask}>{displayedTitle}</Text>
          {displayedItem ? (
            <>
              <Text style={styles.time}>
                {formatTime(displayedItem.start)} — {formatTime(displayedItem.end)}
              </Text>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${progressPercent}%` as DimensionValue },
                  ]}
                />
              </View>
              <Text style={styles.remaining}>
                {isCurrentActivityPaused
                  ? 'Activity paused'
                  : focus.stateKind === 'active_now' || focus.stateKind === 'available_now'
                  ? formatDuration(Math.max(0, Math.ceil((displayedItem.end.getTime() - currentTime.getTime()) / 60000))) + ' remaining'
                  : 'Starts in ' + formatDuration(Math.max(0, Math.ceil((displayedItem.start.getTime() - currentTime.getTime()) / 60000)))}
              </Text>
              {nowItem && nowItem.kind === 'task' && (
                <View style={styles.actions}>
                  <Pressable style={styles.actionButton} onPress={handleDone}>
                    <Text style={styles.actionText}>Done</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handlePause}>
                    <Text style={styles.secondaryText}>{isCurrentActivityPaused ? 'Resume' : 'Pause'}</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handleSkip}>
                    <Text style={styles.secondaryText}>Can't do this</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.remaining}>No more activities today</Text>
          )}
        </View>

        {/* ─── Ask Life OS CTA & Suggestion Chips ─── */}
        <View style={styles.aiCard}>
          <Pressable style={styles.aiButton} onPress={() => router.push('/chat')}>
            <Text style={styles.aiIcon}>✦</Text>
            <View style={styles.aiTextContainer}>
              <Text style={styles.aiTitle}>Ask Life OS</Text>
              <Text style={styles.aiSubtitle}>Tell me what you want to achieve today</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
            {SUGGESTIONS.map((suggestion) => (
              <SuggestionChip
                key={suggestion}
                label={suggestion}
                onPress={() => handleChipPress(suggestion)}
              />
            ))}
          </ScrollView>
        </View>

        {/* ─── Up Next ─── */}
        {focus.upNextItems.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Up next</Text>
            </View>
            {focus.upNextItems.map((activity) => (
              <ScheduleItem
                key={activity.id}
                start={activity.start}
                end={activity.end}
                title={activity.title}
                duration={activity.durationMinutes}
              />
            ))}
          </>
        )}

        {/* ─── Unscheduled ─── */}
        {focus.unscheduledTasks.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <Text style={styles.sectionTitle}>Not scheduled today</Text>
            </View>
            {focus.unscheduledTasks.map((task) => (
              <ScheduleItem
                key={task.id}
                title={task.title}
                duration={task.durationMinutes}
                timeLabel="Not scheduled"
              />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </GestureDetector>
  );
}

// ─── Schedule Item ────────────────────────────────────────────────────────────

function ScheduleItem({
  start,
  end,
  title,
  duration,
  timeLabel,
}: {
  start?: Date;
  end?: Date;
  title: string;
  duration: number;
  timeLabel?: string;
}) {
  return (
    <View style={styles.scheduleItem}>
      <Text style={styles.itemTime}>
        {timeLabel ?? (start && end ? formatTime(start) + ' — ' + formatTime(end) : '')}
      </Text>
      <View style={styles.itemLine} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDuration}>{duration} min</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  calendarIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#191C22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { flex: 1, backgroundColor: '#0B0D10' },
  content: { padding: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: '#8D929A', fontSize: 15 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 3 },

  nowCard: { backgroundColor: '#171A20', borderRadius: 24, padding: 22, marginBottom: 20 },
  nowLabel: { color: '#A7A0FF', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  currentTask: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  time: { color: '#9A9EA6', fontSize: 15, marginTop: 8 },
  progressBg: { height: 5, backgroundColor: '#292D35', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#A7A0FF', borderRadius: 3 },
  remaining: { color: '#777D87', fontSize: 13, marginTop: 9 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  actionButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  actionText: { color: '#0B0D10', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#252932', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  secondaryText: { color: '#D2D5DA', fontWeight: '600' },

  aiCard: { backgroundColor: '#14171C', borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#20242C' },
  aiButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiIcon: { color: '#A7A0FF', fontSize: 22, marginRight: 12 },
  aiTextContainer: { flex: 1 },
  aiTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  aiSubtitle: { color: '#777D87', fontSize: 12, marginTop: 2 },
  arrow: { color: '#9A9EA6', fontSize: 22 },
  chipsContainer: { gap: 8, paddingTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },

  scheduleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  itemTime: { width: 70, color: '#858A94', fontSize: 12 },
  itemLine: { width: 2, height: 35, backgroundColor: '#30343C', marginRight: 14 },
  itemContent: { flex: 1, backgroundColor: '#14171C', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  itemDuration: { color: '#737983', fontSize: 13 },
});
