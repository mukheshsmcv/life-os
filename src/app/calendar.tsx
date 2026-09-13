import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Event, Task, useTasks } from '@/contexts/tasks-context';
import { formatDisplayDate, getDateString, getTodayString } from '@/lib/date-time';
import { DEFAULT_SCHEDULING_SETTINGS, scheduleTasks } from '@/lib/scheduler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function minutesToDisplay(totalMins: number): string {
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${pad(mins)} ${period}`;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatBlockTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${period}`;
}

function parseDateParts(dateStr: string): { dow: string; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return { dow: dows[d.getUTCDay()], day };
}

function buildDateStrip(): string[] {
  return Array.from({ length: 7 }, (_, i) => getDateString(i - 3));
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

type ScheduledItem = Task & {
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

type TaskDetailSheetProps = {
  item: ScheduledItem | null;
  onClose: () => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
};

function TaskDetailSheet({ item, onClose, onComplete, onSkip }: TaskDetailSheetProps) {
  if (!item) return null;

  const canAct = item.status === 'pending';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ds.overlay} onPress={onClose} />
      <View style={ds.sheet}>
        <View style={ds.handle} />
        <View style={ds.sheetHeader}>
          <Text style={ds.sheetType}>TASK</Text>
          <Pressable onPress={onClose} style={ds.closeBtn} accessibilityLabel="Close">
            <Text style={ds.closeX}>✕</Text>
          </Pressable>
        </View>

        <Text style={ds.sheetTitle}>{item.title}</Text>

        <View style={ds.sheetMeta}>
          <View style={ds.metaItem}>
            <Text style={ds.metaLabel}>DURATION</Text>
            <Text style={ds.metaValue}>{formatDuration(item.durationMinutes)}</Text>
          </View>
          <View style={ds.metaItem}>
            <Text style={ds.metaLabel}>PRIORITY</Text>
            <Text style={[ds.metaValue, item.priority === 'high' ? ds.priHigh : item.priority === 'medium' ? ds.priMedium : ds.priLow]}>
              {item.priority.toUpperCase()}
            </Text>
          </View>
          <View style={ds.metaItem}>
            <Text style={ds.metaLabel}>STATUS</Text>
            <Text style={ds.metaValue}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={ds.timeBlock}>
          <Text style={ds.timeLabel}>SCHEDULED TIME</Text>
          <Text style={ds.timeValue}>
            {formatBlockTime(item.start)} — {formatBlockTime(item.end)}
          </Text>
        </View>

        {canAct && (
          <View style={ds.actions}>
            <Pressable
              style={ds.actionPrimary}
              onPress={() => {
                onComplete(item.id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Mark task done">
              <Text style={ds.actionPrimaryText}>Done</Text>
            </Pressable>
            <Pressable
              style={ds.actionSecondary}
              onPress={() => {
                onSkip(item.id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Skip task">
              <Text style={ds.actionSecondaryText}>Skip</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Event Detail Sheet ───────────────────────────────────────────────────────

type EventDetailSheetProps = {
  item: Event | null;
  onClose: () => void;
  onDelete: (id: string) => void;
};

function EventDetailSheet({ item, onClose, onDelete }: EventDetailSheetProps) {
  if (!item) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ds.overlay} onPress={onClose} />
      <View style={ds.sheet}>
        <View style={ds.handle} />
        <View style={ds.sheetHeader}>
          <Text style={ds.sheetType}>FIXED EVENT</Text>
          <Pressable onPress={onClose} style={ds.closeBtn} accessibilityLabel="Close">
            <Text style={ds.closeX}>✕</Text>
          </Pressable>
        </View>

        <Text style={ds.sheetTitle}>{item.title}</Text>

        <View style={ds.timeBlock}>
          <Text style={ds.timeLabel}>EVENT TIME</Text>
          <Text style={ds.timeValue}>
            {minutesToDisplay(item.startMinute)} — {minutesToDisplay(item.endMinute)}
          </Text>
          {item.notes ? <Text style={ds.notesText}>{item.notes}</Text> : null}
        </View>

        <View style={ds.actions}>
          <Pressable
            style={ds.actionDelete}
            onPress={() => {
              onDelete(item.id);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete event">
            <Text style={ds.actionDeleteText}>Delete Event</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ds = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#171A20',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#303640',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetType: {
    color: '#A7A0FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 28,
  },
  sheetMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  metaItem: { gap: 4 },
  metaLabel: {
    color: '#4A5060',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metaValue: {
    color: '#E8E9EC',
    fontSize: 14,
    fontWeight: '600',
  },
  priHigh: { color: '#FF7B7B' },
  priMedium: { color: '#A7A0FF' },
  priLow: { color: '#737983' },
  timeBlock: {
    backgroundColor: '#0B0D10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 4,
  },
  timeLabel: {
    color: '#4A5060',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timeValue: {
    color: '#E8E9EC',
    fontSize: 16,
    fontWeight: '600',
  },
  notesText: {
    color: '#9A9EA6',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionPrimaryText: { color: '#0B0D10', fontWeight: '700', fontSize: 15 },
  actionSecondary: {
    flex: 1,
    backgroundColor: '#252932',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionSecondaryText: { color: '#D2D5DA', fontWeight: '600', fontSize: 15 },
  actionDelete: {
    flex: 1,
    backgroundColor: '#2A1818',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionDeleteText: { color: '#FF7B7B', fontWeight: '700', fontSize: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, getEventsForDate, completeTask, skipTask, deleteTask, deleteEvent } = useTasks();
  const todayStr = getTodayString();
  const dateStrip = buildDateStrip();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [detailItem, setDetailItem] = useState<ScheduledItem | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isViewingToday = selectedDate === todayStr;

  const dayEvents = getEventsForDate(selectedDate);
  const explicitDayTasks = tasks.filter((t) => t.date === selectedDate);
  const undatedTasks = isViewingToday ? tasks.filter((t) => t.date == null) : [];
  const dayTasks = [...explicitDayTasks, ...undatedTasks];

  const referenceDate = isViewingToday
    ? now
    : (() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0);
      })();

  const schedulerEvents = dayEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startMinute: e.startMinute,
    endMinute: e.endMinute,
  }));

  const schedule = scheduleTasks(dayTasks, DEFAULT_SCHEDULING_SETTINGS, referenceDate, schedulerEvents);
  const taskMap = new Map(dayTasks.map((t) => [t.id, t]));

  const explicitScheduledBlocks: ScheduledItem[] = schedule.blocks.flatMap((block) => {
    if (block.taskId.startsWith('event-')) return [];
    const task = taskMap.get(block.taskId);
    return task ? [{ ...task, ...block }] : [];
  });

  const unscheduledTasks = schedule.unscheduledTaskIds.flatMap((id) => {
    const task = taskMap.get(id);
    return task ? [task] : [];
  });

  const totalItemsCount = dayTasks.length + dayEvents.length;
  const currentMinute = dateToMinutes(now);

  type TimelineItem =
    | { kind: 'event'; data: Event }
    | { kind: 'task'; data: ScheduledItem }
    | { kind: 'freetime'; startMinute: number; endMinute: number };

  const timelineItems: TimelineItem[] = [];

  const allTimed: Array<{ startMinute: number; endMinute: number; item: TimelineItem }> = [
    ...dayEvents.map((e) => ({
      startMinute: e.startMinute,
      endMinute: e.endMinute,
      item: { kind: 'event' as const, data: e },
    })),
    ...explicitScheduledBlocks.map((b) => ({
      startMinute: b.startMinute,
      endMinute: b.endMinute,
      item: { kind: 'task' as const, data: b },
    })),
  ].sort((a, b) => a.startMinute - b.startMinute);

  let lastEnd = DEFAULT_SCHEDULING_SETTINGS.planningStartMinute;
  for (const entry of allTimed) {
    const gap = entry.startMinute - lastEnd;
    if (gap >= 30) {
      timelineItems.push({
        kind: 'freetime',
        startMinute: lastEnd,
        endMinute: entry.startMinute,
      });
    }
    timelineItems.push(entry.item);
    lastEnd = Math.max(lastEnd, entry.endMinute);
  }

  const priorityColors: Record<string, string> = {
    high: '#FF7B7B',
    medium: '#A7A0FF',
    low: '#4A5060',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SCHEDULE</Text>
          <Text style={styles.title}>Calendar</Text>
        </View>
        {!isViewingToday && (
          <Pressable
            style={styles.todayBtn}
            onPress={() => setSelectedDate(todayStr)}
            accessibilityRole="button"
            accessibilityLabel="Go to today">
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Date Strip ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}>
        {dateStrip.map((dateStr) => {
          const { dow, day } = parseDateParts(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          return (
            <Pressable
              key={dateStr}
              onPress={() => setSelectedDate(dateStr)}
              style={[styles.dateItem, isSelected && styles.dateItemSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${dow} ${day}${isToday ? ' (today)' : ''}`}>
              <Text style={[styles.dateDow, isSelected && styles.dateDowSelected]}>{dow}</Text>
              <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>{day}</Text>
              {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ─── Selected Date Row ─── */}
      <View style={styles.selectedDateRow}>
        <Text style={styles.selectedDateLabel}>{formatDisplayDate(selectedDate)}</Text>
        <Text style={styles.taskCount}>
          {totalItemsCount === 0
            ? 'No plans'
            : `${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'}`}
        </Text>
      </View>

      {/* ─── Schedule ─── */}
      <ScrollView contentContainerStyle={styles.content}>
        {totalItemsCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No plans for this day.</Text>
            <Text style={styles.emptySubtitle}>
              Ask Life OS or tap + to add tasks or events for{' '}
              {formatDisplayDate(selectedDate).toLowerCase()}.
            </Text>
          </View>
        ) : (
          <>
            {/* ─── Timeline ─── */}
            {timelineItems.map((item, idx) => {
              if (item.kind === 'freetime') {
                const gapMins = item.endMinute - item.startMinute;
                const h = Math.floor(gapMins / 60);
                const m = gapMins % 60;
                const label = h > 0 ? (m > 0 ? `${h}h ${m}m free` : `${h}h free`) : `${m}m free`;
                const showNow =
                  isViewingToday &&
                  currentMinute >= item.startMinute &&
                  currentMinute < item.endMinute;
                return (
                  <View key={`free-${idx}`}>
                    {showNow && <NowIndicator currentMinute={currentMinute} />}
                    <View style={styles.freeTimeRow}>
                      <Text style={styles.freeTimeTime}>{minutesToDisplay(item.startMinute)}</Text>
                      <View style={styles.freeTimeLine} />
                      <Text style={styles.freeTimeLabel}>{label}</Text>
                    </View>
                  </View>
                );
              }

              if (item.kind === 'event') {
                const ev = item.data;
                const dur = ev.endMinute - ev.startMinute;
                const showNow =
                  isViewingToday &&
                  currentMinute >= ev.startMinute &&
                  currentMinute < ev.endMinute;
                return (
                  <View key={ev.id}>
                    {showNow && <NowIndicator currentMinute={currentMinute} />}
                    <Pressable
                      onPress={() => setDetailEvent(ev)}
                      style={styles.timelineRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${ev.title} event detail`}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{minutesToDisplay(ev.startMinute)}</Text>
                        <View style={styles.timeLine} />
                        <Text style={styles.timeText}>{minutesToDisplay(ev.endMinute)}</Text>
                      </View>
                      <View style={[styles.card, styles.eventCard]}>
                        <View style={[styles.stripe, { backgroundColor: '#FCD34D' }]} />
                        <View style={styles.cardBody}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle}>{ev.title}</Text>
                            <View style={styles.eventBadge}>
                              <Text style={styles.eventBadgeText}>FIXED</Text>
                            </View>
                          </View>
                          <Text style={styles.cardMeta}>
                            {dur} min{ev.notes ? ` · ${ev.notes}` : ''}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.deleteBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            deleteEvent(ev.id);
                          }}
                          accessibilityLabel="Delete event">
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  </View>
                );
              }

              if (item.kind === 'task') {
                const block = item.data;
                const isDone = block.status !== 'pending';
                const showNow =
                  isViewingToday &&
                  currentMinute >= block.startMinute &&
                  currentMinute < block.endMinute;
                return (
                  <View key={block.id}>
                    {showNow && <NowIndicator currentMinute={currentMinute} />}
                    <Pressable
                      onPress={() => setDetailItem(block)}
                      style={styles.timelineRow}
                      accessibilityRole="button"
                      accessibilityLabel={`${block.title} task detail`}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{formatBlockTime(block.start)}</Text>
                        <View style={styles.timeLine} />
                        <Text style={styles.timeText}>{formatBlockTime(block.end)}</Text>
                      </View>
                      <View style={[styles.card, isDone && styles.cardDone]}>
                        <View
                          style={[
                            styles.stripe,
                            { backgroundColor: priorityColors[block.priority] ?? '#4A5060' },
                          ]}
                        />
                        <View style={styles.cardBody}>
                          <View style={styles.cardTitleRow}>
                            <Text style={[styles.cardTitle, isDone && styles.cardTitleDone]}>
                              {block.title}
                            </Text>
                            <View style={styles.taskBadge}>
                              <Text style={styles.taskBadgeText}>TASK</Text>
                            </View>
                          </View>
                          <Text style={styles.cardMeta}>
                            {formatDuration(block.durationMinutes)} · {block.priority}
                            {isDone ? ` · ${block.status}` : ''}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              }

              return null;
            })}

            {/* ─── Unscheduled ─── */}
            {unscheduledTasks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>COULD NOT FIT</Text>
                {unscheduledTasks.map((task) => (
                  <View key={task.id} style={[styles.timelineRow, styles.unscheduledRow]}>
                    <View style={styles.timeCol}>
                      <Text style={styles.noTimeText}>—</Text>
                    </View>
                    <View style={[styles.card, styles.cardUnscheduled]}>
                      <View
                        style={[
                          styles.stripe,
                          { backgroundColor: priorityColors[task.priority] ?? '#4A5060' },
                        ]}
                      />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{task.title}</Text>
                        <Text style={styles.cardMeta}>
                          {formatDuration(task.durationMinutes)} · {task.priority} · unscheduled
                        </Text>
                      </View>
                      <View style={styles.cardActions}>
                        {task.status === 'pending' && (
                          <Pressable
                            style={styles.doneBtnSmall}
                            onPress={() => completeTask(task.id)}
                            accessibilityLabel="Complete task">
                            <Text style={styles.doneBtnSmallText}>✓</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.deleteBtnSmall}
                          onPress={() => deleteTask(task.id)}
                          accessibilityLabel="Delete task">
                          <Text style={styles.deleteBtnSmallText}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* ─── Task Detail Sheet ─── */}
      {detailItem && (
        <TaskDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onComplete={completeTask}
          onSkip={skipTask}
        />
      )}

      {/* ─── Event Detail Sheet ─── */}
      {detailEvent && (
        <EventDetailSheet
          item={detailEvent}
          onClose={() => setDetailEvent(null)}
          onDelete={deleteEvent}
        />
      )}
    </View>
  );
}

// ─── Now Indicator ────────────────────────────────────────────────────────────

function NowIndicator({ currentMinute }: { currentMinute: number }) {
  const h = Math.floor(currentMinute / 60);
  const m = currentMinute % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const label = `NOW · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;

  return (
    <View style={ni.row}>
      <Text style={ni.label}>{label}</Text>
      <View style={ni.line} />
    </View>
  );
}

const ni = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    gap: 10,
  },
  label: {
    color: '#FF7B7B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#FF7B7B',
    opacity: 0.5,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  eyebrow: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 2 },
  todayBtn: {
    backgroundColor: '#252932',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  todayBtnText: { color: '#B0B4BB', fontSize: 13, fontWeight: '600' },

  strip: { maxHeight: 100 },
  stripContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  dateItem: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#171A20',
  },
  dateItemSelected: { backgroundColor: '#A7A0FF' },
  dateDow: { color: '#4A5060', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  dateDowSelected: { color: '#0B0D10' },
  dateDay: { color: '#E8E9EC', fontSize: 20, fontWeight: '700', marginTop: 2 },
  dateDaySelected: { color: '#0B0D10' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A7A0FF',
    marginTop: 4,
  },
  todayDotSelected: { backgroundColor: '#0B0D10' },

  selectedDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  selectedDateLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  taskCount: { color: '#737983', fontSize: 13 },

  content: { paddingHorizontal: 20, paddingBottom: 30 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#737983', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  freeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  freeTimeTime: { width: 60, color: '#4A5060', fontSize: 12, fontWeight: '500' },
  freeTimeLine: { flex: 1, height: 1, backgroundColor: '#1E2228' },
  freeTimeLabel: { color: '#4A5060', fontSize: 12, fontWeight: '500' },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  timeCol: { width: 60, alignItems: 'flex-start' },
  timeText: { color: '#737983', fontSize: 12, fontWeight: '500' },
  timeLine: { width: 2, height: 12, backgroundColor: '#252932', marginVertical: 2, marginLeft: 10 },
  noTimeText: { color: '#4A5060', fontSize: 14, fontWeight: '700' },

  card: {
    flex: 1,
    backgroundColor: '#171A20',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252932',
  },
  cardDone: { opacity: 0.5, borderColor: '#1E2228' },
  eventCard: { borderColor: '#3D3418' },
  cardUnscheduled: { backgroundColor: '#14161B', borderColor: '#20232B' },
  stripe: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600', flex: 1 },
  cardTitleDone: { color: '#4A5060', textDecorationLine: 'line-through' },
  eventBadge: {
    backgroundColor: '#3D3418',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventBadgeText: { color: '#FCD34D', fontSize: 10, fontWeight: '700' },
  taskBadge: {
    backgroundColor: '#252932',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskBadgeText: { color: '#A7A0FF', fontSize: 10, fontWeight: '700' },
  cardMeta: { color: '#737983', fontSize: 12, marginTop: 4 },

  deleteBtn: { padding: 12 },
  deleteBtnText: { color: '#FF7B7B', fontSize: 14, fontWeight: '700' },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
  doneBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnSmallText: { color: '#5ECC8B', fontSize: 12, fontWeight: '700' },
  deleteBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnSmallText: { color: '#FF7B7B', fontSize: 12, fontWeight: '700' },

  sectionTitle: { color: '#FF7B7B', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 12 },
  unscheduledRow: { opacity: 0.8 },
});
