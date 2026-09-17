import { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTasks, TaskPriority } from '@/contexts/tasks-context';
import { getTodayString, getDateString, isValidDateString } from '@/lib/date-time';
import { TimeWheelPicker } from '@/components/time-wheel-picker';

type Props = {
  visible: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  activityId?: string;
  activityType?: 'task' | 'event';
};

export function AddActionModal({ visible, onClose, mode = 'create', activityId, activityType = 'task' }: Props) {
  const { tasks, events, addTask, addEvent, updateTask, updateEvent } = useTasks();
  const [activeTab, setActiveTab] = useState<'task' | 'event'>(activityType);
  const [formError, setFormError] = useState<string | null>(null);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState<number>(60);
  const [taskCustomDuration, setTaskCustomDuration] = useState('');
  const [taskDateType, setTaskDateType] = useState<'anytime' | 'today' | 'tomorrow' | 'custom'>('today');
  const [taskCustomDate, setTaskCustomDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDateType, setEventDateType] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [eventCustomDate, setEventCustomDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState<number>(1140); // 19:00 -> 7:00 PM
  const [eventEndTime, setEventEndTime] = useState<number>(1260); // 21:00 -> 9:00 PM
  const [eventNotes, setEventNotes] = useState('');

  const todayStr = getTodayString();
  const tomorrowStr = getDateString(1);

  const resetForm = () => {
    setFormError(null);
    setTaskTitle('');
    setTaskDuration(60);
    setTaskCustomDuration('');
    setTaskDateType('today');
    setTaskCustomDate('');
    setTaskPriority('medium');

    setEventTitle('');
    setEventDateType('today');
    setEventCustomDate('');
    setEventStartTime(1140);
    setEventEndTime(1260);
    setEventNotes('');
  };

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && activityId) {
        setActiveTab(activityType);
        if (activityType === 'task') {
          const task = tasks.find((t) => t.id === activityId);
          if (task) {
            setTaskTitle(task.title);
            setTaskDuration(task.durationMinutes);
            setTaskPriority(task.priority);
            if (!task.scheduling.date) setTaskDateType('anytime');
            else if (task.scheduling.date === todayStr) setTaskDateType('today');
            else if (task.scheduling.date === tomorrowStr) setTaskDateType('tomorrow');
            else { setTaskDateType('custom'); setTaskCustomDate(task.scheduling.date); }
          }
        } else {
          const evt = events.find((e) => e.id === activityId);
          if (evt) {
            setEventTitle(evt.title);
            if (evt.scheduling.date === todayStr) setEventDateType('today');
            else if (evt.scheduling.date === tomorrowStr) setEventDateType('tomorrow');
            else { setEventDateType('custom'); setEventCustomDate(evt.scheduling.date || ''); }
            setEventStartTime(evt.scheduling.startMinute || 1140);
            setEventEndTime(evt.scheduling.endMinute || 1260);
            setEventNotes(evt.notes || '');
          }
        }
      } else {
        setActiveTab(activityType);
        resetForm();
      }
    }
  }, [visible, mode, activityId, activityType]);

  const switchTab = (tab: 'task' | 'event') => {
    setFormError(null);
    setActiveTab(tab);
  };

  const handleCreateTask = () => {
    setFormError(null);

    if (!taskTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }

    let finalDuration = taskDuration;
    if (taskCustomDuration.trim()) {
      const parsed = parseInt(taskCustomDuration, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setFormError('Duration must be greater than 0 minutes.');
        return;
      }
      finalDuration = parsed;
    }

    if (finalDuration <= 0) {
      setFormError('Duration must be greater than 0 minutes.');
      return;
    }

    let finalDate: string | null = null;
    if (taskDateType === 'today') {
      finalDate = todayStr;
    } else if (taskDateType === 'tomorrow') {
      finalDate = tomorrowStr;
    } else if (taskDateType === 'custom') {
      const trimmedDate = taskCustomDate.trim();
      if (!trimmedDate || !isValidDateString(trimmedDate)) {
        setFormError('Enter a valid date in YYYY-MM-DD format (e.g. 2026-09-26).');
        return;
      }
      finalDate = trimmedDate;
    }

    const payload = {
      title: taskTitle.trim(),
      durationMinutes: finalDuration,
      priority: taskPriority,
      date: finalDate,
      scheduling: {
        mode: 'flexible' as const,
        date: finalDate,
        startMinute: null,
        endMinute: null,
      },
    };

    if (mode === 'edit' && activityId) {
      updateTask(activityId, payload);
    } else {
      addTask(payload);
    }

    resetForm();
    onClose();
  };

  const handleCreateEvent = () => {
    setFormError(null);

    if (!eventTitle.trim()) {
      setFormError('Event title is required.');
      return;
    }

    let finalDate = todayStr;
    if (eventDateType === 'tomorrow') {
      finalDate = tomorrowStr;
    } else if (eventDateType === 'custom') {
      const trimmedDate = eventCustomDate.trim();
      if (!trimmedDate || !isValidDateString(trimmedDate)) {
        setFormError('Enter a valid date in YYYY-MM-DD format (e.g. 2026-09-26).');
        return;
      }
      finalDate = trimmedDate;
    }

    if (eventStartTime >= eventEndTime) {
      setFormError('End time must be after start time.');
      return;
    }

    const payload = {
      title: eventTitle.trim(),
      date: finalDate,
      startMinute: eventStartTime,
      endMinute: eventEndTime,
      notes: eventNotes.trim() || undefined,
      scheduling: {
        mode: 'fixed' as const,
        date: finalDate,
        startMinute: eventStartTime,
        endMinute: eventEndTime,
      },
    };

    if (mode === 'edit' && activityId) {
      updateEvent(activityId, payload);
    } else {
      addEvent(payload);
    }

    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Top Bar / Header */}
          <View style={styles.header}>
            <View style={styles.tabSelector}>
              <Pressable
                onPress={() => mode !== 'edit' && switchTab('task')}
                style={[styles.tabButton, activeTab === 'task' && styles.tabButtonActive, mode === 'edit' && activeTab !== 'task' && { opacity: 0.3 }]}>
                <Text style={[styles.tabText, activeTab === 'task' && styles.tabTextActive]}>
                  ➕ Task
                </Text>
              </Pressable>
              <Pressable
                onPress={() => mode !== 'edit' && switchTab('event')}
                style={[styles.tabButton, activeTab === 'event' && styles.tabButtonActive, mode === 'edit' && activeTab !== 'event' && { opacity: 0.3 }]}>
                <Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>
                  📅 Fixed Event
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.formContent} keyboardShouldPersistTaps="handled">
            {activeTab === 'task' ? (
              /* ─── TASK FORM ─── */
              <View style={styles.formGroup}>
                <Text style={styles.label}>TASK TITLE</Text>
                <TextInput
                  value={taskTitle}
                  onChangeText={(text) => {
                    setTaskTitle(text);
                    if (formError) setFormError(null);
                  }}
                  placeholder="e.g. Study Pathology"
                  placeholderTextColor="#636870"
                  style={styles.input}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>DURATION (MINUTES)</Text>
                <View style={styles.chipRow}>
                  {[15, 30, 45, 60, 90, 120].map((mins) => (
                    <Pressable
                      key={mins}
                      onPress={() => {
                        setTaskDuration(mins);
                        setTaskCustomDuration('');
                        if (formError) setFormError(null);
                      }}
                      style={[
                        styles.chip,
                        taskDuration === mins && !taskCustomDuration && styles.chipActive,
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          taskDuration === mins && !taskCustomDuration && styles.chipTextActive,
                        ]}>
                        {mins}m
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>DATE</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    onPress={() => {
                      setTaskDateType('anytime');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, taskDateType === 'anytime' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'anytime' && styles.chipTextActive]}>
                      Anytime
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTaskDateType('today');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, taskDateType === 'today' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'today' && styles.chipTextActive]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTaskDateType('tomorrow');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, taskDateType === 'tomorrow' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'tomorrow' && styles.chipTextActive]}>
                      Tomorrow
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTaskDateType('custom');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, taskDateType === 'custom' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'custom' && styles.chipTextActive]}>
                      Custom
                    </Text>
                  </Pressable>
                </View>

                {taskDateType === 'custom' && (
                  <TextInput
                    value={taskCustomDate}
                    onChangeText={(text) => {
                      setTaskCustomDate(text);
                      if (formError) setFormError(null);
                    }}
                    placeholder="YYYY-MM-DD (e.g. 2026-09-26)"
                    placeholderTextColor="#636870"
                    style={[styles.input, { marginTop: 10 }]}
                  />
                )}

                <Text style={[styles.label, { marginTop: 16 }]}>PRIORITY</Text>
                <View style={styles.chipRow}>
                  {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => {
                        setTaskPriority(p);
                        if (formError) setFormError(null);
                      }}
                      style={[styles.chip, taskPriority === p && styles.chipActive]}>
                      <Text style={[styles.chipText, taskPriority === p && styles.chipTextActive]}>
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {formError && <Text style={styles.errorText}>{formError}</Text>}

                <Pressable onPress={handleCreateTask} style={styles.submitButton}>
                  <Text style={styles.submitText}>{mode === 'edit' ? 'Save Changes' : 'Save Task'}</Text>
                </Pressable>
              </View>
            ) : (
              /* ─── EVENT FORM ─── */
              <View style={styles.formGroup}>
                <Text style={styles.label}>EVENT TITLE</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={(text) => {
                    setEventTitle(text);
                    if (formError) setFormError(null);
                  }}
                  placeholder="e.g. Dinner with Rahul"
                  placeholderTextColor="#636870"
                  style={styles.input}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>DATE</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    onPress={() => {
                      setEventDateType('today');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, eventDateType === 'today' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'today' && styles.chipTextActive]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEventDateType('tomorrow');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, eventDateType === 'tomorrow' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'tomorrow' && styles.chipTextActive]}>
                      Tomorrow
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEventDateType('custom');
                      if (formError) setFormError(null);
                    }}
                    style={[styles.chip, eventDateType === 'custom' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'custom' && styles.chipTextActive]}>
                      Custom
                    </Text>
                  </Pressable>
                </View>

                {eventDateType === 'custom' && (
                  <TextInput
                    value={eventCustomDate}
                    onChangeText={(text) => {
                      setEventCustomDate(text);
                      if (formError) setFormError(null);
                    }}
                    placeholder="YYYY-MM-DD (e.g. 2026-09-26)"
                    placeholderTextColor="#636870"
                    style={[styles.input, { marginTop: 10 }]}
                  />
                )}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.timeLabelRow}>
                      <Text style={styles.label}>START TIME</Text>
                    </View>
                    <TimeWheelPicker value={eventStartTime} onChange={setEventStartTime} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.timeLabelRow}>
                      <Text style={styles.label}>END TIME</Text>
                    </View>
                    <TimeWheelPicker value={eventEndTime} onChange={setEventEndTime} />
                  </View>
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>NOTES (OPTIONAL)</Text>
                <TextInput
                  value={eventNotes}
                  onChangeText={setEventNotes}
                  placeholder="e.g. Dr. Sharma Clinic"
                  placeholderTextColor="#636870"
                  style={styles.input}
                />

                {formError && <Text style={styles.errorText}>{formError}</Text>}

                <Pressable onPress={handleCreateEvent} style={styles.submitButton}>
                  <Text style={styles.submitText}>{mode === 'edit' ? 'Save Changes' : 'Save Fixed Event'}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#171A20',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252932',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#0B0D10',
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#A7A0FF',
  },
  tabText: {
    color: '#737983',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#0B0D10',
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  formContent: {
    padding: 20,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    color: '#A7A0FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#0B0D10',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#252932',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#0B0D10',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252932',
  },
  chipActive: {
    backgroundColor: '#A7A0FF',
    borderColor: '#A7A0FF',
  },
  chipText: {
    color: '#E8E9EC',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0B0D10',
    fontWeight: '700',
  },
  errorText: {
    color: '#FF9A9A',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: {
    color: '#0B0D10',
    fontSize: 16,
    fontWeight: '700',
  },
  timeLabelRow: { marginBottom: 8 },
});

