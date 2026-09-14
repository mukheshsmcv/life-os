import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
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
import { SymbolView } from 'expo-symbols';

import { Event, Task, useTasks } from '@/contexts/tasks-context';
import { formatDisplayDate, getDateString, getTodayString, getCalendarDays, addMonths, addDays } from '@/lib/date-time';
import { DEFAULT_SCHEDULING_SETTINGS, scheduleTasks } from '@/lib/scheduler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string { return String(n).padStart(2, '0'); }

function minutesToDisplay(totalMins: number): string {
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${pad(mins)} ${period}`;
}

type TimeVal = { h: string; m: string; isPM: boolean };

function TimeInput({ value, onChange, label }: { value: TimeVal; onChange: (v: TimeVal) => void; label: string }) {
  return (
    <View style={ti.container}>
      <Text style={ti.label}>{label}</Text>
      <View style={ti.row}>
        <TextInput
          style={ti.input} keyboardType="number-pad" maxLength={2}
          value={value.h} onChangeText={(h) => onChange({ ...value, h })}
          placeholder="12" placeholderTextColor="#4A5060"
        />
        <Text style={ti.colon}>:</Text>
        <TextInput
          style={ti.input} keyboardType="number-pad" maxLength={2}
          value={value.m} onChangeText={(m) => onChange({ ...value, m })}
          placeholder="00" placeholderTextColor="#4A5060"
        />
        <Pressable style={ti.amPmBtn} onPress={() => onChange({ ...value, isPM: !value.isPM })}>
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
  input: { backgroundColor: '#1E2228', color: '#E8E9EC', fontSize: 16, fontWeight: '600', borderRadius: 8, width: 48, height: 48, textAlign: 'center' },
  colon: { color: '#737983', fontSize: 18, fontWeight: '700', marginHorizontal: 8 },
  amPmBtn: { marginLeft: 12, backgroundColor: '#252932', borderRadius: 8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  amPmText: { color: '#E8E9EC', fontSize: 13, fontWeight: '700' },
});

// Fallback vector-drawn calendar icon component
function CalendarFallbackIcon({ color = '#A7A0FF' }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {/* Top rings/pins */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 14, marginBottom: -2, zIndex: 1 }}>
        <View style={{ width: 2, height: 4, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: 4, backgroundColor: color, borderRadius: 1 }} />
      </View>
      {/* Calendar body */}
      <View style={{ width: 20, height: 18, borderWidth: 1.5, borderColor: color, borderRadius: 4, overflow: 'hidden' }}>
        {/* Top header strip */}
        <View style={{ height: 4, backgroundColor: color, width: '100%' }} />
        {/* Inner grid dots */}
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', alignItems: 'center', padding: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

// ─── Main Calendar Screen ─────────────────────────────────────────────────────

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tasks, events, addEvent } = useTasks();
  
  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [dateStripCenter, setDateStripCenter] = useState<string>(todayStr);
  
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<string>(todayStr.substring(0, 7) + '-01');
  
  const [showBlockTime, setShowBlockTime] = useState(false);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState<TimeVal>({ h: '4', m: '00', isPM: true });
  const [blockEnd, setBlockEnd] = useState<TimeVal>({ h: '5', m: '00', isPM: true });
  const [blockError, setBlockError] = useState('');

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute 121 days array centered around dateStripCenter (-60 to +60)
  const stripDates = useMemo(() => {
    const arr = [];
    for (let i = -60; i <= 60; i++) {
      arr.push(addDays(dateStripCenter, i));
    }
    return arr;
  }, [dateStripCenter]);

  const flatListRef = useRef<FlatList>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const [visibleMonthLabel, setVisibleMonthLabel] = useState('');

  useEffect(() => {
    const [y, m] = todayStr.split('-');
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    setVisibleMonthLabel(`${monthNames[parseInt(m, 10) - 1]} ${y}`);
  }, [todayStr]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
      if (centerItem && centerItem.item) {
        const [y, m] = centerItem.item.split('-');
        const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        setVisibleMonthLabel(`${monthNames[parseInt(m, 10) - 1]} ${y}`);
      }
    }
  }).current;

  // Jump list to selected date
  useEffect(() => {
    const idx = stripDates.indexOf(selectedDate);
    if (idx !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  }, [selectedDate, stripDates]);

  // Month Picker math
  const [pickerY, pickerM] = pickerMonth.split('-').map(Number);
  const pickerDays = getCalendarDays(pickerY, pickerM);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pickerHeaderStr = `${monthNames[pickerM - 1]} ${pickerY}`;

  const handlePickerPrev = () => setPickerMonth(prev => addMonths(prev, -1));
  const handlePickerNext = () => setPickerMonth(prev => addMonths(prev, 1));
  const handlePickerToday = () => {
    setPickerMonth(todayStr.substring(0, 7) + '-01');
    setSelectedDate(todayStr);
    setDateStripCenter(todayStr);
    setShowMonthPicker(false);
  };
  const handlePickerSelect = (dStr: string) => {
    setSelectedDate(dStr);
    setDateStripCenter(dStr);
    setShowMonthPicker(false);
  };

  // Activity Indicators Maps (canonical + legacy date support)
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, { events: boolean; tasks: boolean }>();
    for (const ev of events) {
      const d = ev.scheduling?.date || ev.date;
      if (d) {
        if (!map.has(d)) map.set(d, { events: false, tasks: false });
        map.get(d)!.events = true;
      }
    }
    for (const t of tasks) {
      const d = t.scheduling?.date || t.date;
      if (d) {
        if (!map.has(d)) map.set(d, { events: false, tasks: false });
        map.get(d)!.tasks = true;
      }
    }
    return map;
  }, [events, tasks]);

  // Canonical resolution for selectedDate
  const isViewingToday = selectedDate === todayStr;
  const dayEvents = events.filter((e) => (e.scheduling?.date || e.date) === selectedDate);
  const explicitDayTasks = tasks.filter((t) => (t.scheduling?.date || t.date) === selectedDate);
  
  const pendingDayTasks = explicitDayTasks.filter(t => t.status === 'pending');
  const completedOrSkippedTasks = explicitDayTasks.filter(t => t.status !== 'pending');

  const referenceDate = isViewingToday ? now : (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  })();

  const schedulerEvents = dayEvents.map((e) => {
    const startM = e.scheduling?.startMinute ?? e.startMinute;
    const durM = e.scheduling?.durationMinutes;
    const endM = durM != null ? startM + durM : e.endMinute;
    return { id: e.id, title: e.title, startMinute: startM, endMinute: endM };
  });

  // Only actively schedule PENDING tasks
  const pendingSchedulerTasks = pendingDayTasks.map(t => ({
    ...t,
    scheduledStartMinute: t.scheduling?.startMinute ?? t.scheduledStartMinute ?? null,
  }));

  const schedule = scheduleTasks(pendingSchedulerTasks, DEFAULT_SCHEDULING_SETTINGS, referenceDate, schedulerEvents);

  const scheduledBlockMap = new Map<string, { startMinute: number; endMinute: number }>();
  for (const block of schedule.blocks) {
    if (!block.taskId.startsWith('event-')) {
      scheduledBlockMap.set(block.taskId, {
        startMinute: block.startMinute,
        endMinute: block.endMinute,
      });
    }
  }

  type AgendaItem = {
    id: string;
    title: string;
    duration: number;
    startMinute: number | null;
    kind: 'event' | 'task';
    status: 'event' | 'pending' | 'completed' | 'skipped';
  };

  // 1. Events
  const eventItems: AgendaItem[] = dayEvents.map(e => {
    const startM = e.scheduling?.startMinute ?? e.startMinute;
    const dur = e.scheduling?.durationMinutes ?? ((e.endMinute ?? 60) - (e.startMinute ?? 0));
    return {
      id: e.id,
      title: e.title,
      duration: dur > 0 ? dur : 60,
      startMinute: startM != null && startM >= 0 ? startM : null,
      kind: 'event',
      status: 'event',
    };
  });

  // 2. Pending Tasks (use scheduled start if placed, else canonical start)
  const pendingItems: AgendaItem[] = pendingDayTasks.map(t => {
    const scheduled = scheduledBlockMap.get(t.id);
    const startM = scheduled ? scheduled.startMinute : (t.scheduling?.startMinute ?? t.scheduledStartMinute ?? null);
    return {
      id: t.id,
      title: t.title,
      duration: t.durationMinutes || 30,
      startMinute: startM != null && startM >= 0 ? startM : null,
      kind: 'task',
      status: 'pending',
    };
  });

  // 3. Historical Tasks (completed/skipped) - strictly canonical, bypass scheduler
  const historyItems: AgendaItem[] = completedOrSkippedTasks.map(t => {
    const startM = t.scheduling?.startMinute ?? t.scheduledStartMinute ?? null;
    return {
      id: t.id,
      title: t.title,
      duration: t.durationMinutes || 30,
      startMinute: startM != null && startM >= 0 ? startM : null,
      kind: 'task',
      status: t.status === 'skipped' ? 'skipped' : 'completed',
    };
  });

  const allDayItems = [...eventItems, ...pendingItems, ...historyItems];

  const timedItems = allDayItems
    .filter(item => item.startMinute !== null)
    .sort((a, b) => a.startMinute! - b.startMinute!);

  const anytimeItems = allDayItems.filter(item => item.startMinute === null);

  // Diagnostic Logs
  useEffect(() => {
    console.log('[CALENDAR_RUNTIME] NEW CALENDAR CODE LOADED');
  }, []);

  useEffect(() => {
    console.log(`[CALENDAR_RUNTIME] selectedDate=${selectedDate}`);
    console.log(`[CALENDAR_RUNTIME] viewMonth=${visibleMonthLabel}`);
    console.log(`[CALENDAR_RUNTIME] dateStripCount=${stripDates.length}`);
    console.log(`[CALENDAR_RUNTIME] calendarIconRendered=true`);
    console.log(`[CALENDAR_RUNTIME] selectedDateTasks=${explicitDayTasks.length} (pending: ${pendingDayTasks.length}, history: ${completedOrSkippedTasks.length})`);
    console.log(`[CALENDAR_RUNTIME] timedItems=${timedItems.length}, anytimeItems=${anytimeItems.length}`);
    
    console.log('[CALENDAR_HISTORY]', {
      selectedDate,
      allTasks: tasks.length,
      matchingTasks: explicitDayTasks.length,
      completed: completedOrSkippedTasks.filter(t => t.status === 'completed').length,
      pending: pendingDayTasks.length,
      skipped: completedOrSkippedTasks.filter(t => t.status === 'skipped').length,
      events: dayEvents.length,
    });
  }, [selectedDate, visibleMonthLabel, stripDates.length, explicitDayTasks.length, pendingDayTasks.length, completedOrSkippedTasks.length, dayEvents.length, tasks.length, timedItems.length, anytimeItems.length]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* DATE STRIP */}
      <View style={styles.stripContainer}>
        <Text style={styles.visibleMonthLabel}>{visibleMonthLabel}</Text>
        <View style={styles.stripRow}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setShowMonthPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Open month picker"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <View style={StyleSheet.absoluteFill}>
                <CalendarFallbackIcon color="#A7A0FF" />
              </View>
              <SymbolView
                name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                size={24}
                tintColor="#A7A0FF"
                fallback={<CalendarFallbackIcon color="#A7A0FF" />}
              />
            </View>
          </Pressable>
          
          <FlatList
            style={{ flex: 1, minWidth: 0 }}
            ref={flatListRef}
            horizontal
            data={stripDates}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={60 - 3}
            getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            contentContainerStyle={styles.stripContent}
            renderItem={({ item }) => {
              const date = new Date(item + 'T12:00:00Z');
              const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getUTCDay()];
              const dayNum = date.getUTCDate();
              const isSelected = item === selectedDate;
              const isToday = item === todayStr;
              const hasEvents = activitiesByDate.get(item)?.events;
              const hasTasks = activitiesByDate.get(item)?.tasks;

              return (
                <Pressable
                  onPress={() => setSelectedDate(item)}
                  style={[styles.stripItem, isSelected && styles.stripItemSelected]}>
                  <Text style={[styles.stripDow, isSelected && styles.stripTextSelected]}>{dow}</Text>
                  <Text style={[styles.stripDay, isSelected && styles.stripTextSelected, isToday && !isSelected && styles.stripDayToday]}>{dayNum}</Text>
                  <View style={styles.dotsRow}>
                    {hasEvents && <View style={[styles.dot, { backgroundColor: isSelected ? '#0B0D10' : '#FCD34D' }]} />}
                    {hasTasks && <View style={[styles.dot, { backgroundColor: isSelected ? '#0B0D10' : '#A7A0FF' }]} />}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </View>

      {/* BODY */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        
        {!showBlockTime ? (
          <>
            <View style={styles.agendaHeader}>
              <Text style={styles.agendaTitle}>{
                isViewingToday ? 'TODAY' 
                : addDays(todayStr, -1) === selectedDate ? 'YESTERDAY'
                : addDays(todayStr, 1) === selectedDate ? 'TOMORROW'
                : formatDisplayDate(selectedDate).toUpperCase()
              }</Text>
            </View>
            
            <ScrollView style={styles.agendaScroll} contentContainerStyle={styles.agendaContent} showsVerticalScrollIndicator={false}>
              {timedItems.length === 0 && anytimeItems.length === 0 ? (
                <Text style={styles.emptyText}>No plans for this date.</Text>
              ) : (
                <>
                  {timedItems.map((item) => {
                    const isDone = item.status === 'completed' || item.status === 'skipped';
                    const isSkipped = item.status === 'skipped';
                    const typeLabel = item.status.toUpperCase();
                    
                    return (
                      <View key={item.id} style={[styles.agendaItem, isDone && styles.agendaItemDone]}>
                        <View style={styles.agendaTimeCol}>
                          <Text style={styles.agendaTimeText}>{minutesToDisplay(item.startMinute!)}</Text>
                        </View>
                        <View style={styles.agendaBodyCol}>
                          <Text style={[
                            styles.agendaItemTitle,
                            isDone && !isSkipped && styles.agendaItemDoneTitle,
                            isSkipped && styles.agendaItemSkippedTitle
                          ]}>
                            {item.title}
                          </Text>
                          <Text style={styles.agendaItemMeta}>{item.duration}m · {typeLabel}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {anytimeItems.length > 0 && (
                    <View style={styles.anytimeSection}>
                      <Text style={styles.anytimeSectionTitle}>ANYTIME</Text>
                      {anytimeItems.map((item) => {
                        const isDone = item.status === 'completed' || item.status === 'skipped';
                        const isSkipped = item.status === 'skipped';
                        const typeLabel = item.status.toUpperCase();
                        
                        return (
                          <View key={item.id} style={[styles.agendaItem, isDone && styles.agendaItemDone]}>
                            <View style={styles.agendaTimeCol}>
                              <Text style={styles.agendaTimeText}>Anytime</Text>
                            </View>
                            <View style={styles.agendaBodyCol}>
                              <Text style={[
                                styles.agendaItemTitle,
                                isDone && !isSkipped && styles.agendaItemDoneTitle,
                                isSkipped && styles.agendaItemSkippedTitle
                              ]}>
                                {item.title}
                              </Text>
                              <Text style={styles.agendaItemMeta}>{item.duration}m · {typeLabel}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={styles.footer}>
              <Pressable style={styles.blockBtn} onPress={() => setShowBlockTime(true)}>
                <Text style={styles.blockBtnText}>+ Block time</Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* BLOCK TIME FORM */
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>BLOCK TIME</Text>
            
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

            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowBlockTime(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveBlock}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* MONTH PICKER MODAL */}
      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMonthPicker(false)} />
          <View style={[styles.pickerCard, { paddingBottom: insets.bottom || 20 }]}>
            
            <View style={styles.pickerHeader}>
              <Pressable onPress={handlePickerPrev} style={styles.pickerNavBtn}><Text style={styles.pickerNavText}>{'<'}</Text></Pressable>
              <Text style={styles.pickerMonthStr}>{pickerHeaderStr}</Text>
              <Pressable onPress={handlePickerNext} style={styles.pickerNavBtn}><Text style={styles.pickerNavText}>{'>'}</Text></Pressable>
            </View>

            <View style={styles.pickerGrid}>
              <View style={styles.pickerDowRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dow, i) => (
                  <Text key={i} style={styles.pickerDow}>{dow}</Text>
                ))}
              </View>
              <View style={styles.pickerDays}>
                {pickerDays.map((dStr) => {
                  const [, m, d] = dStr.split('-').map(Number);
                  const isCur = m === pickerM;
                  const isSel = dStr === selectedDate;
                  const isTod = dStr === todayStr;
                  return (
                    <Pressable
                      key={dStr}
                      onPress={() => handlePickerSelect(dStr)}
                      style={[
                        styles.pickerCell,
                        isSel && styles.pickerCellSel,
                        !isCur && styles.pickerCellFaded
                      ]}>
                      <Text style={[
                        styles.pickerDayText,
                        isSel && styles.pickerTextSel,
                        isTod && !isSel && styles.pickerTextTod
                      ]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable style={styles.pickerTodayBtn} onPress={handlePickerToday}>
              <Text style={styles.pickerTodayText}>Today</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#191C22', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#FFF', fontSize: 20, fontWeight: '600' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  stripContainer: { borderBottomWidth: 1, borderBottomColor: '#1E2228', paddingBottom: 12, width: '100%' },
  visibleMonthLabel: { color: '#E8E9EC', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 },
  stripRow: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  iconBtn: {
    width: 48,
    height: 64,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252932',
    marginRight: 8,
  },
  stripContent: { paddingRight: 16, gap: 8 },
  stripItem: { width: 52, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  stripItemSelected: { backgroundColor: '#A7A0FF' },
  stripDow: { color: '#737983', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  stripDay: { color: '#E8E9EC', fontSize: 18, fontWeight: '600' },
  stripDayToday: { color: '#FF7B7B' },
  stripTextSelected: { color: '#0B0D10' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 4, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  body: { flex: 1 },
  agendaHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  agendaTitle: { color: '#A7A0FF', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  agendaScroll: { flex: 1 },
  agendaContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  emptyText: { color: '#737983', fontSize: 14, textAlign: 'center', marginTop: 40 },
  
  agendaItem: { flexDirection: 'row', backgroundColor: '#12141A', borderRadius: 12, padding: 16 },
  agendaItemDone: { opacity: 0.6 },
  agendaTimeCol: { width: 75 },
  agendaTimeText: { color: '#E8E9EC', fontSize: 13, fontWeight: '600' },
  agendaBodyCol: { flex: 1 },
  agendaItemTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  agendaItemDoneTitle: { textDecorationLine: 'line-through', color: '#737983' },
  agendaItemSkippedTitle: { fontStyle: 'italic', color: '#737983' },
  agendaItemMeta: { color: '#737983', fontSize: 12, marginTop: 4, fontWeight: '500' },

  anytimeSection: { marginTop: 8, gap: 12 },
  anytimeSectionTitle: { color: '#737983', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4, marginTop: 8 },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#1E2228' },
  blockBtn: { backgroundColor: '#252932', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  blockBtnText: { color: '#E8E9EC', fontSize: 16, fontWeight: '700' },

  // Block Form
  formScroll: { flex: 1 },
  formContent: { padding: 20 },
  formTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 24 },
  titleInput: { backgroundColor: '#1E2228', color: '#E8E9EC', fontSize: 16, borderRadius: 12, padding: 16, marginBottom: 24 },
  timeInputsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  errorText: { color: '#FF7B7B', fontSize: 13, marginBottom: 16 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#252932', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#E8E9EC', fontSize: 16, fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: '#A7A0FF', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#0B0D10', fontSize: 16, fontWeight: '700' },

  // Picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#12141A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerNavBtn: { padding: 10 },
  pickerNavText: { color: '#737983', fontSize: 20, fontWeight: '700' },
  pickerMonthStr: { color: '#E8E9EC', fontSize: 16, fontWeight: '700' },
  pickerGrid: { marginBottom: 20 },
  pickerDowRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pickerDow: { width: '14.28%', textAlign: 'center', color: '#4A5060', fontSize: 11, fontWeight: '700' },
  pickerDays: { flexDirection: 'row', flexWrap: 'wrap' },
  pickerCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  pickerCellSel: { backgroundColor: '#A7A0FF' },
  pickerCellFaded: { opacity: 0.3 },
  pickerDayText: { color: '#E8E9EC', fontSize: 15, fontWeight: '500' },
  pickerTextSel: { color: '#0B0D10', fontWeight: '700' },
  pickerTextTod: { color: '#FF7B7B', fontWeight: '700' },
  pickerTodayBtn: { backgroundColor: '#1E2228', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  pickerTodayText: { color: '#A7A0FF', fontSize: 15, fontWeight: '700' },
});
