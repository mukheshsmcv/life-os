import { usePathname, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutAnimation,
  type DimensionValue,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { SuggestionChip } from '@/components/SuggestionChip';
import { AddActionModal } from '@/components/add-action-modal';
import { Task, useTasks } from '@/contexts/tasks-context';
import { getTodayString } from '@/lib/date-time';
import { determineTodayFocus } from '@/lib/focus-engine';
import {
  consumePendingActivityId,
  subscribePendingActivity,
} from '@/lib/notifications';
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
  const { tasks, getEventsForDate, startTask, pauseTask, resumeTask, completeTask, skipTask, completeEvent, skipEvent } = useTasks();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [focusedActivityId, setFocusedActivityId] = useState<string | null>(null);
  const [isNowExpanded, setIsNowExpanded] = useState(false);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocusTargetRef = useRef<string | null>(null);
  const scrollViewRef = useRef<any>(null);
  const itemLayoutYMapRef = useRef<Map<string, number>>(new Map());

  const [actionSheetActivity, setActionSheetActivity] = useState<{ id: string, title: string, kind: 'task' | 'event' } | null>(null);
  const [addModalMode, setAddModalMode] = useState<'create' | 'edit'>('create');
  const [addModalType, setAddModalType] = useState<'task' | 'event'>('task');
  const [addModalId, setAddModalId] = useState<string | undefined>(undefined);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  const handleOpenActionSheet = (id: string, title: string, kind: 'task' | 'event') => {
    setActionSheetActivity({ id, title, kind });
  };

  const handleActionDone = () => {
    if (!actionSheetActivity) return;
    if (actionSheetActivity.kind === 'task') completeTask(actionSheetActivity.id);
    else completeEvent(actionSheetActivity.id);
    setActionSheetActivity(null);
  };

  const handleActionSkip = () => {
    if (!actionSheetActivity) return;
    if (actionSheetActivity.kind === 'task') skipTask(actionSheetActivity.id);
    else skipEvent(actionSheetActivity.id);
    setActionSheetActivity(null);
  };

  const handleActionReschedule = (id?: string, kind?: 'task' | 'event') => {
    const targetId = id || actionSheetActivity?.id;
    const targetKind = kind || actionSheetActivity?.kind;
    if (!targetId || !targetKind) return;
    setAddModalMode('edit');
    setAddModalType(targetKind);
    setAddModalId(targetId);
    setIsAddModalVisible(true);
    setActionSheetActivity(null);
  };

  const toggleNowExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsNowExpanded(!isNowExpanded);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayString();
  const todayEvents = getEventsForDate(todayStr);

  const applyFocus = (activityId: string) => {
    const matchingTask = tasks.find((t) => t.id === activityId);
    const matchingEvent = todayEvents.find((e) => e.id === activityId);

    // Missing, deleted, completed, or skipped activities are ignored safely
    if (!matchingTask && !matchingEvent) {
      return;
    }
    if (matchingTask && matchingTask.status !== 'pending') {
      return;
    }

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }
    setFocusedActivityId(activityId);

    // Bring into attention / scroll if item coordinate is known
    const targetY = itemLayoutYMapRef.current.get(activityId);
    if (targetY !== undefined && scrollViewRef.current) {
      try {
        scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
      } catch {}
    }

    // Naturally dismiss focus highlight after 4.5 seconds
    focusTimerRef.current = setTimeout(() => {
      setFocusedActivityId(null);
    }, 4500);
  };

  useEffect(() => {
    // Check pending activity on mount (cold-start or background tap)
    const initialPending = consumePendingActivityId();
    if (initialPending) {
      pendingFocusTargetRef.current = initialPending;
      applyFocus(initialPending);
    }

    // Subscribe to notification response taps while Today is mounted
    const unsub = subscribePendingActivity((newId) => {
      if (newId) {
        consumePendingActivityId();
        pendingFocusTargetRef.current = newId;
        applyFocus(newId);
      }
    });

    return () => {
      unsub();
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  // Check if pending target can be focused once tasks/events hydrate or update
  useEffect(() => {
    if (pendingFocusTargetRef.current && !focusedActivityId) {
      applyFocus(pendingFocusTargetRef.current);
    }
  }, [tasks, todayEvents]);

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
  
  const progressTime = (() => {
    if (isCurrentActivityPaused && displayedItem?.task?.execution?.lastPausedAtMinute) {
      const d = new Date(currentTime);
      d.setHours(Math.floor(displayedItem.task.execution.lastPausedAtMinute / 60));
      d.setMinutes(displayedItem.task.execution.lastPausedAtMinute % 60);
      return d;
    }
    return currentTime;
  })();

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
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
        <View style={styles.nowCardContainer}>
          <Pressable
            onPress={() => displayedItem && toggleNowExpanded()}
          onLayout={(e) => {
            if (displayedItem) {
              itemLayoutYMapRef.current.set(displayedItem.id, e.nativeEvent.layout.y);
            }
          }}
          style={[styles.nowCard, displayedItem?.id === focusedActivityId && styles.focusedCard]}>
          {displayedItem?.id === focusedActivityId && (
            <View style={styles.focusBadge}>
              <Text style={styles.focusBadgeText}>OPENED FROM REMINDER</Text>
            </View>
          )}
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
            </>
          ) : (
            <Text style={styles.remaining}>No more activities today</Text>
          )}
          </Pressable>

          {/* Expanded Actions */}
          {displayedItem && isNowExpanded && (
            <View style={styles.nowExpandedActions}>
              <View style={styles.expandedRow1}>
                {displayedItem.kind === 'task' && displayedItem.task?.execution?.activeState !== 'planned' && (
                  <Pressable 
                    style={[styles.expandedBtn, { flex: 1, backgroundColor: '#A7A0FF' }]} 
                    onPress={() => {
                      const executionState = displayedItem.task?.execution?.activeState ?? 'planned';
                      if (executionState === 'running') {
                        pauseTask(displayedItem.id);
                      } else if (executionState === 'paused') {
                        resumeTask(displayedItem.id);
                      }
                      setIsNowExpanded(false);
                    }}>
                    <Text style={[styles.expandedBtnText, { color: '#0B0D10' }]}>
                      {displayedItem.task?.execution?.activeState === 'running' ? 'Pause' : 'Resume'}
                    </Text>
                  </Pressable>
                )}

                {displayedItem.kind === 'task' && (displayedItem.task?.execution?.activeState ?? 'planned') === 'planned' && (
                  <Pressable 
                    style={[styles.expandedBtn, { flex: 1, backgroundColor: '#A7A0FF' }]} 
                    onPress={() => {
                      startTask(displayedItem.id);
                      setIsNowExpanded(false);
                    }}>
                    <Text style={[styles.expandedBtnText, { color: '#0B0D10' }]}>Start</Text>
                  </Pressable>
                )}

                {(!displayedItem.task || displayedItem.task.execution?.activeState !== 'planned') && (
                  <Pressable 
                    style={[styles.expandedBtn, { flex: 1, backgroundColor: '#FFFFFF' }]} 
                    onPress={() => {
                      if (displayedItem.kind === 'task') completeTask(displayedItem.id);
                      else completeEvent(displayedItem.id);
                      setIsNowExpanded(false);
                    }}>
                    <Text style={[styles.expandedBtnText, { color: '#0B0D10' }]}>✓ Done</Text>
                  </Pressable>
                )}
              </View>
              
              <View style={[styles.expandedRow2, { marginTop: 12, gap: 12 }]}>
                <Pressable 
                  style={[styles.expandedBtn, { flex: 1, backgroundColor: '#252932' }]} 
                  onPress={() => {
                    handleActionReschedule(displayedItem.id, displayedItem.kind);
                    setIsNowExpanded(false);
                  }}>
                  <Text style={[styles.expandedBtnText, { color: '#D2D5DA' }]}>Reschedule</Text>
                </Pressable>

                <Pressable 
                  style={[styles.expandedBtn, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF7B7B' }]} 
                  onPress={() => {
                    if (displayedItem.kind === 'task') skipTask(displayedItem.id);
                    else skipEvent(displayedItem.id);
                    setIsNowExpanded(false);
                  }}>
                  <Text style={[styles.expandedBtnText, { color: '#FF7B7B' }]}>Can't do this</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ─── Ask Space Time CTA & Suggestion Chips ─── */}
        <View style={styles.aiCard}>
          <Pressable style={styles.aiButton} onPress={() => router.push('/chat')}>
            <Text style={styles.aiIcon}>✦</Text>
            <View style={styles.aiTextContainer}>
              <Text style={styles.aiTitle}>Ask Space Time</Text>
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
            {focus.upNextItems.map((item) => (
              <ScheduleItem
                key={item.id}
                onLayout={(e) => itemLayoutYMapRef.current.set(item.id, e.nativeEvent.layout.y)}
                start={item.start}
                end={item.end}
                title={item.title}
                duration={item.durationMinutes}
                isFocused={item.id === focusedActivityId}
                onPress={() => handleOpenActionSheet(item.id, item.title, item.kind)}
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
                onLayout={(e) => itemLayoutYMapRef.current.set(task.id, e.nativeEvent.layout.y)}
                title={task.title}
                duration={task.durationMinutes}
                timeLabel="Not scheduled"
                isFocused={task.id === focusedActivityId}
                onPress={() => handleOpenActionSheet(task.id, task.title, 'task')}
              />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Sheet Modal */}
      <Modal visible={!!actionSheetActivity} transparent animationType="fade" onRequestClose={() => setActionSheetActivity(null)}>
        <Pressable style={styles.actionSheetOverlay} onPress={() => setActionSheetActivity(null)}>
          <View style={[styles.actionSheetCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle} numberOfLines={1}>{actionSheetActivity?.title}</Text>
            </View>
            <View style={styles.actionSheetBody}>
              <Pressable style={styles.actionSheetButton} onPress={handleActionDone}>
                <Text style={styles.actionSheetButtonText}>Done</Text>
              </Pressable>
              <Pressable style={styles.actionSheetButton} onPress={() => handleActionReschedule()}>
                <Text style={styles.actionSheetButtonText}>Reschedule</Text>
              </Pressable>
              <Pressable style={[styles.actionSheetButton, styles.actionSheetButtonDestructive]} onPress={handleActionSkip}>
                <Text style={styles.actionSheetButtonTextDestructive}>Can't do this</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <AddActionModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        mode={addModalMode}
        activityId={addModalId}
        activityType={addModalType}
      />
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
  isFocused,
  onLayout,
  onPress,
}: {
  start?: Date;
  end?: Date;
  title: string;
  duration: number;
  timeLabel?: string;
  isFocused?: boolean;
  onLayout?: (e: any) => void;
  onPress?: () => void;
}) {
  return (
    <Pressable onLayout={onLayout} onPress={onPress} style={styles.scheduleItem}>
      <Text style={styles.itemTime}>
        {timeLabel ?? (start && end ? formatTime(start) + ' — ' + formatTime(end) : '')}
      </Text>
      <View style={[styles.itemLine, isFocused && styles.focusedItemLine]} />
      <View style={[styles.itemContent, isFocused && styles.focusedItemContent]}>
        <View style={{ flex: 1 }}>
          {isFocused && <Text style={styles.itemFocusBadge}>REMINDER TARGET</Text>}
          <Text style={[styles.itemTitle, isFocused && styles.focusedItemTitle]}>{title}</Text>
        </View>
        <Text style={styles.itemDuration}>{duration} min</Text>
      </View>
    </Pressable>
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

  nowCardContainer: { marginBottom: 20 },
  nowCard: { backgroundColor: '#171A20', borderRadius: 24, padding: 22, zIndex: 2 },
  focusedCard: {
    borderWidth: 2,
    borderColor: '#A7A0FF',
    shadowColor: '#A7A0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  focusBadge: {
    backgroundColor: 'rgba(167, 160, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 160, 255, 0.4)',
  },
  focusBadgeText: {
    color: '#A7A0FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  nowLabel: { color: '#A7A0FF', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  currentTask: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  time: { color: '#9A9EA6', fontSize: 15, marginTop: 8 },
  progressBg: { height: 5, backgroundColor: '#292D35', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#A7A0FF', borderRadius: 3 },
  remaining: { color: '#777D87', fontSize: 13, marginTop: 9 },

  nowExpandedActions: {
    backgroundColor: '#171A20',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 22,
    paddingTop: 40,
    marginTop: -24,
    zIndex: 1,
    borderWidth: 1,
    borderColor: '#252932',
    borderTopWidth: 0,
  },
  expandedRow1: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  expandedRow2: { flexDirection: 'row' },
  expandedBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expandedBtnText: { fontSize: 16, fontWeight: '700' },

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
  focusedItemLine: {
    backgroundColor: '#A7A0FF',
    width: 3,
  },
  focusedItemContent: {
    borderWidth: 1.5,
    borderColor: '#A7A0FF',
    backgroundColor: '#1B1E26',
  },
  focusedItemTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  itemFocusBadge: {
    color: '#A7A0FF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  itemTime: { width: 70, color: '#858A94', fontSize: 12 },
  itemLine: { width: 2, height: 35, backgroundColor: '#30343C', marginRight: 14 },
  itemContent: { flex: 1, backgroundColor: '#14171C', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  itemDuration: { color: '#737983', fontSize: 13 },

  actionSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  actionSheetCard: { backgroundColor: '#171A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  actionSheetHeader: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#252932', paddingBottom: 16 },
  actionSheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  actionSheetBody: { gap: 12 },
  actionSheetButton: { backgroundColor: '#252932', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  actionSheetButtonText: { color: '#E8E9EC', fontSize: 16, fontWeight: '600' },
  actionSheetButtonDestructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF7B7B' },
  actionSheetButtonTextDestructive: { color: '#FF7B7B', fontSize: 16, fontWeight: '600' },
});
