import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Event, Task, useTasks } from '@/contexts/tasks-context';
import { formatDisplayDate, getDateString, getTodayString, getCalendarDays, addMonths } from '@/lib/date-time';
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type ScheduledItem = Task & {
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

// ─── Time Input ──────────────────────────────────────────────────────────────

type TimeVal = { h: string; m: string; isPM: boolean };

function TimeInput({ value, onChange, label }: { value: TimeVal; onChange: (v: TimeVal) => void; label: string }) {
  return (
    <View style={ti.container}>
      <Text style={ti.label}>{label}</Text>
      <View style={ti.row}>
        <TextInput
          style={ti.input}
          keyboardType="number-pad"
          maxLength={2}
          value={value.h}
          onChangeText={(h) => onChange({ ...value, h })}
          placeholder="12"
          placeholderTextColor="#4A5060"
        />
        <Text style={ti.colon}>:</Text>
        <TextInput
          style={ti.input}
          keyboardType="number-pad"
          maxLength={2}
          value={value.m}
          onChangeText={(m) => onChange({ ...value, m })}
          placeholder="00"
          placeholderTextColor="#4A5060"
        />
        <Pressable
          style={ti.amPmBtn}
          onPress={() => onChange({ ...value, isPM: !value.isPM })}>
          <Text style={ti.amPmText}>{value.isPM ? 'PM' : 'AM'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ti = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: '#1E2228',
    color: '#E8E9EC',
    fontSize: 16,
    fontWeight: '600',
    borderRadius: 8,
    width: 48,
    height: 48,
    textAlign: 'center',
  },
  colon: { color: '#737983', fontSize: 18, fontWeight: '700', marginHorizontal: 8 },
  amPmBtn: {
    marginLeft: 12,
    backgroundColor: '#252932',
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amPmText: { color: '#E8E9EC', fontSize: 13, fontWeight: '700' },
});

// ─── Main Calendar Modal ──────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tasks, events, getEventsForDate, addEvent, completeTask, skipTask, deleteTask, deleteEvent } = useTasks();
  
  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMonth, setViewMonth] = useState<string>(todayStr.substring(0, 7) + '-01');
  const [now, setNow] = useState(() => new Date());

  const [showBlockTime, setShowBlockTime] = useState(false);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState<TimeVal>({ h: '4', m: '00', isPM: true });
  const [blockEnd, setBlockEnd] = useState<TimeVal>({ h: '5', m: '00', isPM: true });
  const [blockError, setBlockError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isViewingToday = selectedDate === todayStr;
  const currentMinute = dateToMinutes(now);
  const [year, month] = viewMonth.split('-').map(Number);
  const calendarDays = getCalendarDays(year, month);

  const handlePrevMonth = () => setViewMonth(prev => addMonths(prev, -1));
  const handleNextMonth = () => setViewMonth(prev => addMonths(prev, 1));
  const handleToday = () => {
    setViewMonth(todayStr.substring(0, 7) + '-01');
    setSelectedDate(todayStr);
  };

  const dayEvents = getEventsForDate(selectedDate);
  const explicitDayTasks = tasks.filter((t) => t.date === selectedDate);
  const undatedTasks = isViewingToday ? tasks.filter((t) => t.date == null) : [];
  const dayTasks = [...explicitDayTasks, ...undatedTasks];
  const pendingDayTasks = dayTasks.filter(t => t.status === 'pending');
  const completedOrSkippedTasks = dayTasks.filter(t => t.status !== 'pending');

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

  const schedule = scheduleTasks(pendingDayTasks, DEFAULT_SCHEDULING_SETTINGS, referenceDate, schedulerEvents);
  const taskMap = new Map(dayTasks.map((t) => [t.id, t]));

  const explicitScheduledBlocks = schedule.blocks.flatMap((block) => {
    if (block.taskId.startsWith('event-')) return [];
    const task = taskMap.get(block.taskId);
    return task ? [{ ...task, ...block } as ScheduledItem] : [];
  });

  const unscheduledTasks = schedule.unscheduledTaskIds.flatMap((id) => {
    const task = taskMap.get(id);
    return task ? [task] : [];
  });

  type TimelineItem =
    | { kind: 'event'; data: Event }
    | { kind: 'task'; data: ScheduledItem }
    | { kind: 'historical'; data: Task };

  const timedHistorical = completedOrSkippedTasks.filter(t => t.scheduledStartMinute !== null);
  const anytimeHistorical = completedOrSkippedTasks.filter(t => t.scheduledStartMinute === null);

  const timelineItems: TimelineItem[] = [
    ...dayEvents.map((e) => ({ kind: 'event' as const, data: e })),
    ...explicitScheduledBlocks.map((b) => ({ kind: 'task' as const, data: b })),
    ...timedHistorical.map((t) => ({ kind: 'historical' as const, data: t })),
  ].sort((a, b) => {
    const startA = a.kind === 'event' ? a.data.startMinute : a.kind === 'historical' ? a.data.scheduledStartMinute! : (a.data as ScheduledItem).startMinute;
    const startB = b.kind === 'event' ? b.data.startMinute : b.kind === 'historical' ? b.data.scheduledStartMinute! : (b.data as ScheduledItem).startMinute;
    return (startA ?? 0) - (startB ?? 0);
  });

  const activitiesByDate = new Map<string, { events: boolean, tasks: boolean }>();
  for (const ev of events) {
    if (!activitiesByDate.has(ev.date)) activitiesByDate.set(ev.date, { events: false, tasks: false });
    activitiesByDate.get(ev.date)!.events = true;
  }
  for (const t of tasks) {
    if (t.date) {
      if (!activitiesByDate.has(t.date)) activitiesByDate.set(t.date, { events: false, tasks: false });
      activitiesByDate.get(t.date)!.tasks = true;
    }
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthHeaderStr = `${monthNames[month - 1]} ${year}`;

  const timeValToMinutes = (tv: TimeVal) => {
    let h = parseInt(tv.h || '0', 10);
    const m = parseInt(tv.m || '0', 10);
    if (tv.isPM && h !== 12) h += 12;
    if (!tv.isPM && h === 12) h = 0;
    return h * 60 + m;
  };

  const handleSaveBlock = () => {
    setBlockError('');
    if (!blockTitle.trim()) { setBlockError('Title is required'); return; }
    const startM = timeValToMinutes(blockStart);
    const endM = timeValToMinutes(blockEnd);
    if (startM >= endM) { setBlockError('End time must be after start time'); return; }

    addEvent({
      title: blockTitle.trim(),
      date: selectedDate,
      startMinute: startM,
      endMinute: endM,
    });
    setBlockTitle('');
    setShowBlockTime(false);
  };

  const totalItemsCount = dayTasks.length + dayEvents.length;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      
      <View style={[styles.modalCard, { paddingBottom: insets.bottom || 20 }]}>
        
        {!showBlockTime ? (
          <>
            {/* Calendar Header */}
            <View style={styles.modalHeader}>
              <View style={styles.monthNav}>
                <Pressable onPress={handlePrevMonth} style={styles.navBtn} hitSlop={10}><Text style={styles.navBtnText}>{'<'}</Text></Pressable>
                <Text style={styles.monthHeaderText}>{monthHeaderStr}</Text>
                <Pressable onPress={handleNextMonth} style={styles.navBtn} hitSlop={10}><Text style={styles.navBtnText}>{'>'}</Text></Pressable>
              </View>
              <Pressable onPress={handleToday} style={styles.todayBtn}><Text style={styles.todayBtnText}>Today</Text></Pressable>
            </View>

            {/* Grid */}
            <View style={styles.gridContainer}>
              <View style={styles.dowRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dow, i) => (
                  <Text key={i} style={styles.gridDow}>{dow}</Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {calendarDays.map((dateStr) => {
                  const [, m, d] = dateStr.split('-').map(Number);
                  const isCurrentMonth = m === month;
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;
                  const hasEvents = activitiesByDate.get(dateStr)?.events;
                  const hasTasks = activitiesByDate.get(dateStr)?.tasks;

                  return (
                    <Pressable
                      key={dateStr}
                      onPress={() => {
                        setSelectedDate(dateStr);
                        if (!isCurrentMonth) setViewMonth(dateStr.substring(0, 7) + '-01');
                      }}
                      style={[
                        styles.gridCell,
                        isSelected && styles.gridCellSelected,
                        !isCurrentMonth && styles.gridCellFaded
                      ]}>
                      <Text style={[
                        styles.gridDayText,
                        isSelected && styles.gridDayTextSelected,
                        isToday && !isSelected && styles.gridDayTextToday
                      ]}>{d}</Text>
                      <View style={styles.dotsRow}>
                        {hasEvents && <View style={[styles.dot, { backgroundColor: '#FCD34D' }, isSelected && { backgroundColor: '#0B0D10' }]} />}
                        {hasTasks && <View style={[styles.dot, { backgroundColor: '#A7A0FF' }, isSelected && { backgroundColor: '#0B0D10' }]} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Agenda Divider */}
            <View style={styles.agendaDivider}>
              <Text style={styles.agendaDateLabel}>{formatDisplayDate(selectedDate).toUpperCase()}</Text>
              <Text style={styles.agendaCount}>{totalItemsCount} items</Text>
            </View>

            {/* Agenda List */}
            <ScrollView style={styles.agendaScroll} showsVerticalScrollIndicator={false}>
              {timelineItems.length === 0 && unscheduledTasks.length === 0 && anytimeHistorical.length === 0 ? (
                <Text style={styles.emptyAgenda}>No plans for this date.</Text>
              ) : (
                <View style={styles.agendaItems}>
                  {timelineItems.map((item, idx) => {
                    const isDone = item.kind === 'historical' || (item.kind === 'task' && item.data.status !== 'pending');
                    const isSkipped = item.kind !== 'event' && item.data.status === 'skipped';
                    const startM = item.kind === 'event' ? item.data.startMinute : item.kind === 'historical' ? item.data.scheduledStartMinute! : (item.data as ScheduledItem).startMinute;
                    const dur = item.kind === 'event' ? ((item.data.endMinute ?? 60) - (item.data.startMinute ?? 0)) : item.data.durationMinutes;
                    const title = item.data.title;
                    const typeLabel = item.kind === 'event' ? 'EVENT' : isDone ? (isSkipped ? 'SKIPPED' : 'COMPLETED') : 'TASK';
                    
                    return (
                      <View key={idx} style={[styles.agendaItem, isDone && styles.agendaItemDone]}>
                        <View style={styles.agendaTimeCol}>
                          <Text style={styles.agendaTimeText}>{minutesToDisplay(startM ?? 0)}</Text>
                        </View>
                        <View style={styles.agendaBody}>
                          <Text style={[styles.agendaTitle, isSkipped && styles.agendaTitleSkipped, isDone && !isSkipped && styles.agendaTitleDone]}>{title}</Text>
                          <Text style={styles.agendaMeta}>{dur}m · {typeLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                  
                  {(unscheduledTasks.length > 0 || anytimeHistorical.length > 0) && (
                    <View style={styles.anytimeSection}>
                      <Text style={styles.anytimeLabel}>ANYTIME</Text>
                      {[...unscheduledTasks, ...anytimeHistorical].map((task, idx) => {
                        const isDone = task.status !== 'pending';
                        const isSkipped = task.status === 'skipped';
                        return (
                          <View key={`any-${idx}`} style={[styles.agendaItem, isDone && styles.agendaItemDone]}>
                            <View style={styles.agendaBody}>
                              <Text style={[styles.agendaTitle, isSkipped && styles.agendaTitleSkipped, isDone && !isSkipped && styles.agendaTitleDone]}>{task.title}</Text>
                              <Text style={styles.agendaMeta}>{formatDuration(task.durationMinutes)} · {isDone ? (isSkipped ? 'SKIPPED' : 'COMPLETED') : 'TASK'}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <Pressable style={styles.blockTimeBtn} onPress={() => setShowBlockTime(true)}>
              <Text style={styles.blockTimeBtnText}>+ Block time</Text>
            </Pressable>
          </>
        ) : (
          /* Time Blocking Form */
          <View style={styles.blockForm}>
            <View style={styles.formHeader}>
              <Pressable onPress={() => setShowBlockTime(false)} style={styles.backBtn} hitSlop={10}>
                <Text style={styles.backBtnText}>{'< Back'}</Text>
              </Pressable>
              <Text style={styles.formTitle}>Block Time</Text>
              <View style={{width: 50}} />
            </View>

            <Text style={styles.agendaDateLabel}>{formatDisplayDate(selectedDate).toUpperCase()}</Text>

            <View style={styles.formBody}>
              <Text style={ti.label}>WHAT ARE YOU DOING?</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Meeting with Narendra"
                placeholderTextColor="#4A5060"
                value={blockTitle}
                onChangeText={setBlockTitle}
              />
              
              <View style={styles.timeInputsRow}>
                <TimeInput label="START TIME" value={blockStart} onChange={setBlockStart} />
                <TimeInput label="END TIME" value={blockEnd} onChange={setBlockEnd} />
              </View>

              {blockError ? <Text style={styles.errorText}>{blockError}</Text> : null}

              <Pressable style={styles.saveBtn} onPress={handleSaveBlock}>
                <Text style={styles.saveBtnText}>Save Block</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#12141A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  
  // Header
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navBtn: { padding: 4 },
  navBtnText: { color: '#737983', fontSize: 20, fontWeight: '700' },
  monthHeaderText: { color: '#E8E9EC', fontSize: 16, fontWeight: '700', minWidth: 130, textAlign: 'center' },
  todayBtn: { backgroundColor: '#1E2228', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  todayBtnText: { color: '#A7A0FF', fontSize: 13, fontWeight: '700' },

  // Grid
  gridContainer: { marginBottom: 16 },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gridDow: { width: '14.28%', textAlign: 'center', color: '#4A5060', fontSize: 11, fontWeight: '700' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  gridCellSelected: { backgroundColor: '#A7A0FF' },
  gridCellFaded: { opacity: 0.3 },
  gridDayText: { color: '#E8E9EC', fontSize: 15, fontWeight: '500' },
  gridDayTextSelected: { color: '#0B0D10', fontWeight: '700' },
  gridDayTextToday: { color: '#FF7B7B', fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  // Agenda
  agendaDivider: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: '#1E2228' },
  agendaDateLabel: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  agendaCount: { color: '#4A5060', fontSize: 12, fontWeight: '600' },
  agendaScroll: { minHeight: 120, maxHeight: 250 },
  emptyAgenda: { color: '#737983', fontSize: 14, textAlign: 'center', marginTop: 20 },
  agendaItems: { gap: 12, paddingBottom: 16 },
  agendaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#171A20', borderRadius: 12 },
  agendaItemDone: { opacity: 0.5 },
  agendaTimeCol: { width: 65 },
  agendaTimeText: { color: '#E8E9EC', fontSize: 13, fontWeight: '600' },
  agendaBody: { flex: 1 },
  agendaTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  agendaTitleDone: { textDecorationLine: 'line-through', color: '#737983' },
  agendaTitleSkipped: { fontStyle: 'italic', color: '#737983' },
  agendaMeta: { color: '#737983', fontSize: 12, marginTop: 4, fontWeight: '500' },
  
  anytimeSection: { marginTop: 8 },
  anytimeLabel: { color: '#FF7B7B', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },

  blockTimeBtn: { backgroundColor: '#252932', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  blockTimeBtnText: { color: '#E8E9EC', fontSize: 15, fontWeight: '700' },

  // Form
  blockForm: { paddingBottom: 20 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 4 },
  backBtnText: { color: '#A7A0FF', fontSize: 15, fontWeight: '600' },
  formTitle: { color: '#E8E9EC', fontSize: 16, fontWeight: '700' },
  formBody: { marginTop: 16 },
  titleInput: { backgroundColor: '#1E2228', color: '#E8E9EC', fontSize: 16, borderRadius: 12, padding: 16, marginBottom: 20 },
  timeInputsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  errorText: { color: '#FF7B7B', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  saveBtn: { backgroundColor: '#A7A0FF', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#0B0D10', fontSize: 16, fontWeight: '700' },
});
