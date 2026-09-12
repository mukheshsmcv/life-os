import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTasks } from '@/contexts/tasks-context';
import { DEFAULT_SCHEDULING_SETTINGS, scheduleTasks } from '@/lib/scheduler';
import { getTodayString, getDateString, formatDisplayDate, isValidDateString } from '@/lib/date-time';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${mins} ${period}`;
}

/**
 * Returns the day-of-week abbreviation (Mon, Tue, …) and day number
 * for a YYYY-MM-DD string without relying on the system locale.
 */
function parseDateParts(dateStr: string): { dow: string; day: number; month: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { dow: dows[d.getUTCDay()], day, month: months[d.getUTCMonth()] };
}

// ─── Generate 7-day date strip (today + 6 more days) ────────────────────────
function buildDateStrip(): string[] {
  return Array.from({ length: 7 }, (_, i) => getDateString(i));
}

// ─── Component ───────────────────────────────────────────────────────────────

function formatMinutesToTime(totalMins: number): string {
  const hours = Math.floor(totalMins / 60);
  const mins = String(totalMins % 60).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins} ${period}`;
}

export default function CalendarScreen() {
  const { tasks, getEventsForDate, completeTask, deleteTask, deleteEvent } = useTasks();
  const todayStr = getTodayString();
  const dateStrip = buildDateStrip();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const dayEvents = getEventsForDate(selectedDate);
  // Explicitly dated tasks for the selected date
  const explicitDayTasks = tasks.filter((t) => t.date === selectedDate);
  // Undated tasks are included only on today's view (Anytime section)
  const undatedTasks = selectedDate === todayStr ? tasks.filter((t) => t.date == null) : [];
  const dayTasks = [...explicitDayTasks, ...undatedTasks];

  // Compute schedule for the selected date using reference Date
  const referenceDate = (() => {
    if (selectedDate === todayStr) return new Date(); // live current time
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0); // local midnight
  })();

  const schedulerEvents = dayEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startMinute: e.startMinute,
    endMinute: e.endMinute,
  }));

  const schedule = scheduleTasks(dayTasks, DEFAULT_SCHEDULING_SETTINGS, referenceDate, schedulerEvents);
  const taskMap = new Map(dayTasks.map((t) => [t.id, t]));

  const scheduledBlocks = schedule.blocks.flatMap((block) => {
    if (block.taskId.startsWith('event-')) return []; // skip fixed event blocks in floating tasks
    const task = taskMap.get(block.taskId);
    return task ? [{ ...task, ...block }] : [];
  });

  const explicitScheduledBlocks = scheduledBlocks.filter((b) => b.date === selectedDate);
  const anytimeScheduledBlocks = scheduledBlocks.filter((b) => b.date == null);

  const unscheduledTasks = schedule.unscheduledTaskIds.flatMap((id) => {
    const task = taskMap.get(id);
    return task ? [task] : [];
  });

  const totalItemsCount = dayTasks.length + dayEvents.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>OVERVIEW</Text>
        <Text style={styles.title}>Calendar</Text>
      </View>

      {/* Date Strip */}
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
              style={[styles.dateItem, isSelected && styles.dateItemSelected]}>
              <Text style={[styles.dateDow, isSelected && styles.dateDowSelected]}>{dow}</Text>
              <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>{day}</Text>
              {isToday && (
                <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Selected date label */}
      <View style={styles.selectedDateRow}>
        <Text style={styles.selectedDateLabel}>{formatDisplayDate(selectedDate)}</Text>
        <Text style={styles.taskCount}>
          {totalItemsCount === 0 ? 'No plans' : `${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'}`}
        </Text>
      </View>

      {/* Schedule Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {totalItemsCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No plans for this day.</Text>
            <Text style={styles.emptySubtitle}>
              Ask your AI planner or tap + to add tasks or events for {formatDisplayDate(selectedDate).toLowerCase()}.
            </Text>
          </View>
        ) : (
          <>
            {/* FIXED EVENTS SECTION */}
            {dayEvents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>FIXED EVENTS</Text>
                {dayEvents.map((ev) => (
                  <View key={ev.id} style={styles.taskCard}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText}>{formatMinutesToTime(ev.startMinute)}</Text>
                      <View style={styles.timeLine} />
                      <Text style={styles.timeText}>{formatMinutesToTime(ev.endMinute)}</Text>
                    </View>
                    <View style={[styles.taskBody, { borderColor: '#A7A0FF', borderWidth: 1 }]}>
                      <View style={[styles.priorityStripe, { backgroundColor: '#FCD34D' }]} />
                      <View style={styles.taskDetails}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.taskTitle}>{ev.title}</Text>
                          <View style={{ backgroundColor: '#261F12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#FCD34D', fontSize: 10, fontWeight: '700' }}>FIXED EVENT</Text>
                          </View>
                        </View>
                        <Text style={styles.taskMeta}>
                          {ev.endMinute - ev.startMinute} min{ev.notes ? ` · ${ev.notes}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardActions}>
                        <Pressable style={styles.deleteButton} onPress={() => deleteEvent(ev.id)}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* SCHEDULED TASKS SECTION */}
            {explicitScheduledBlocks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>SCHEDULED</Text>
                {explicitScheduledBlocks.map((block) => (
                  <View key={block.id} style={styles.taskCard}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText}>{formatTime(block.start)}</Text>
                      <View style={styles.timeLine} />
                      <Text style={styles.timeText}>{formatTime(block.end)}</Text>
                    </View>
                    <View style={[styles.taskBody, block.status !== 'pending' && styles.taskBodyDone]}>
                      <View style={[styles.priorityStripe, styles[`priority_${block.priority}`]]} />
                      <View style={styles.taskDetails}>
                        <Text style={[styles.taskTitle, block.status !== 'pending' && styles.taskTitleDone]}>
                          {block.title}
                        </Text>
                        <Text style={styles.taskMeta}>
                          {block.durationMinutes} min · {block.priority}
                          {block.status !== 'pending' ? ` · ${block.status}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardActions}>
                        {block.status === 'pending' && (
                          <Pressable style={styles.completeButton} onPress={() => completeTask(block.id)}>
                            <Text style={styles.completeButtonText}>Done</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.deleteButton} onPress={() => deleteTask(block.id)}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {anytimeScheduledBlocks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, explicitScheduledBlocks.length > 0 && { marginTop: 24 }]}>
                  ANYTIME / UNDATED TASKS
                </Text>
                {anytimeScheduledBlocks.map((block) => (
                  <View key={block.id} style={styles.taskCard}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText}>{formatTime(block.start)}</Text>
                      <View style={styles.timeLine} />
                      <Text style={styles.timeText}>{formatTime(block.end)}</Text>
                    </View>
                    <View style={[styles.taskBody, block.status !== 'pending' && styles.taskBodyDone]}>
                      <View style={[styles.priorityStripe, styles[`priority_${block.priority}`]]} />
                      <View style={styles.taskDetails}>
                        <Text style={[styles.taskTitle, block.status !== 'pending' && styles.taskTitleDone]}>
                          {block.title}
                        </Text>
                        <Text style={styles.taskMeta}>
                          {block.durationMinutes} min · {block.priority} · anytime
                          {block.status !== 'pending' ? ` · ${block.status}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardActions}>
                        {block.status === 'pending' && (
                          <Pressable style={styles.completeButton} onPress={() => completeTask(block.id)}>
                            <Text style={styles.completeButtonText}>Done</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.deleteButton} onPress={() => deleteTask(block.id)}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {unscheduledTasks.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>COULD NOT FIT IN WINDOW</Text>
                {unscheduledTasks.map((task) => (
                  <View key={task.id} style={[styles.taskCard, styles.taskCardUnscheduled]}>
                    <View style={styles.timeColumn}>
                      <Text style={[styles.timeText, styles.unscheduledTime]}>—</Text>
                    </View>
                    <View style={[styles.taskBody, styles.taskBodyUnscheduled]}>
                      <View style={[styles.priorityStripe, styles[`priority_${task.priority}`]]} />
                      <View style={styles.taskDetails}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <Text style={styles.taskMeta}>{task.durationMinutes} min · {task.priority} · unscheduled</Text>
                      </View>
                      <View style={styles.cardActions}>
                        {task.status === 'pending' && (
                          <Pressable style={styles.completeButton} onPress={() => completeTask(task.id)}>
                            <Text style={styles.completeButtonText}>Done</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.deleteButton} onPress={() => deleteTask(task.id)}>
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrow: { color: '#A7A0FF', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginTop: 4 },

  // ── Date strip ──
  strip: { maxHeight: 96 },
  stripContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  dateItem: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#171A20',
  },
  dateItemSelected: {
    backgroundColor: '#A7A0FF',
  },
  dateDow: { color: '#737983', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  dateDowSelected: { color: '#0B0D10' },
  dateDay: { color: '#E8E9EC', fontSize: 20, fontWeight: '700', marginTop: 2 },
  dateDaySelected: { color: '#0B0D10' },
  todayDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#A7A0FF', marginTop: 4,
  },
  todayDotSelected: { backgroundColor: '#0B0D10' },

  // ── Selected date label ──
  selectedDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#191C22',
  },
  selectedDateLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  taskCount: { color: '#737983', fontSize: 14 },

  // ── Content area ──
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { color: '#A7A0FF', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#737983', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── Task cards ──
  taskCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
    gap: 12,
  },
  taskCardUnscheduled: { opacity: 0.65 },
  timeColumn: {
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  timeText: { color: '#737983', fontSize: 12, fontWeight: '600' },
  unscheduledTime: { color: '#444950', fontSize: 16 },
  timeLine: { width: 1, flex: 1, backgroundColor: '#252932', marginVertical: 4 },

  taskBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#171A20',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
  },
  taskBodyDone: { opacity: 0.55 },
  taskBodyUnscheduled: { borderWidth: 1, borderColor: '#252932', backgroundColor: '#0F1115' },

  priorityStripe: { width: 4, alignSelf: 'stretch' },
  priority_high: { backgroundColor: '#FF7B7B' },
  priority_medium: { backgroundColor: '#A7A0FF' },
  priority_low: { backgroundColor: '#4A5060' },

  taskDetails: { flex: 1, padding: 14 },
  taskTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  taskTitleDone: { color: '#636870', textDecorationLine: 'line-through' },
  taskMeta: { color: '#737983', fontSize: 12, marginTop: 4 },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 6,
  },
  completeButton: {
    backgroundColor: '#A7A0FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completeButtonText: {
    color: '#171A20',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#FF9A9A',
    fontSize: 12,
    fontWeight: '600',
  },
} as any);
 // `as any` for dynamic priority_ keys
