import { useState } from 'react';
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
import { getTodayString, getDateString } from '@/lib/date-time';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AddActionModal({ visible, onClose }: Props) {
  const { addTask, addEvent } = useTasks();
  const [activeTab, setActiveTab] = useState<'task' | 'event'>('task');

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
  const [eventStartTime, setEventStartTime] = useState('07:00 PM');
  const [eventEndTime, setEventEndTime] = useState('09:00 PM');
  const [eventNotes, setEventNotes] = useState('');

  const todayStr = getTodayString();
  const tomorrowStr = getDateString(1);

  const resetForm = () => {
    setTaskTitle('');
    setTaskDuration(60);
    setTaskCustomDuration('');
    setTaskDateType('today');
    setTaskCustomDate('');
    setTaskPriority('medium');

    setEventTitle('');
    setEventDateType('today');
    setEventCustomDate('');
    setEventStartTime('07:00 PM');
    setEventEndTime('09:00 PM');
    setEventNotes('');
  };

  const handleCreateTask = () => {
    if (!taskTitle.trim()) return;

    let finalDuration = taskDuration;
    if (taskCustomDuration.trim()) {
      const parsed = parseInt(taskCustomDuration, 10);
      if (parsed > 0) finalDuration = parsed;
    }

    let finalDate: string | null = null;
    if (taskDateType === 'today') finalDate = todayStr;
    else if (taskDateType === 'tomorrow') finalDate = tomorrowStr;
    else if (taskDateType === 'custom' && taskCustomDate.trim()) {
      finalDate = taskCustomDate.trim();
    }

    addTask({
      title: taskTitle.trim(),
      durationMinutes: finalDuration,
      priority: taskPriority,
      date: finalDate,
    });

    resetForm();
    onClose();
  };

  function parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 19 * 60; // default 7 PM
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const handleCreateEvent = () => {
    if (!eventTitle.trim()) return;

    let finalDate = todayStr;
    if (eventDateType === 'tomorrow') finalDate = tomorrowStr;
    else if (eventDateType === 'custom' && eventCustomDate.trim()) {
      finalDate = eventCustomDate.trim();
    }

    const startMin = parseTimeToMinutes(eventStartTime);
    const endMin = parseTimeToMinutes(eventEndTime);

    addEvent({
      title: eventTitle.trim(),
      date: finalDate,
      startMinute: startMin,
      endMinute: Math.max(startMin + 15, endMin),
      notes: eventNotes.trim() || undefined,
    });

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
                onPress={() => setActiveTab('task')}
                style={[styles.tabButton, activeTab === 'task' && styles.tabButtonActive]}>
                <Text style={[styles.tabText, activeTab === 'task' && styles.tabTextActive]}>
                  ➕ Task
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('event')}
                style={[styles.tabButton, activeTab === 'event' && styles.tabButtonActive]}>
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
                  onChangeText={setTaskTitle}
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
                    onPress={() => setTaskDateType('anytime')}
                    style={[styles.chip, taskDateType === 'anytime' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'anytime' && styles.chipTextActive]}>
                      Anytime
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTaskDateType('today')}
                    style={[styles.chip, taskDateType === 'today' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'today' && styles.chipTextActive]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTaskDateType('tomorrow')}
                    style={[styles.chip, taskDateType === 'tomorrow' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'tomorrow' && styles.chipTextActive]}>
                      Tomorrow
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTaskDateType('custom')}
                    style={[styles.chip, taskDateType === 'custom' && styles.chipActive]}>
                    <Text style={[styles.chipText, taskDateType === 'custom' && styles.chipTextActive]}>
                      Custom
                    </Text>
                  </Pressable>
                </View>

                {taskDateType === 'custom' && (
                  <TextInput
                    value={taskCustomDate}
                    onChangeText={setTaskCustomDate}
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
                      onPress={() => setTaskPriority(p)}
                      style={[styles.chip, taskPriority === p && styles.chipActive]}>
                      <Text style={[styles.chipText, taskPriority === p && styles.chipTextActive]}>
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={handleCreateTask} style={styles.submitButton}>
                  <Text style={styles.submitText}>Save Task</Text>
                </Pressable>
              </View>
            ) : (
              /* ─── EVENT FORM ─── */
              <View style={styles.formGroup}>
                <Text style={styles.label}>EVENT TITLE</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="e.g. Dinner with Rahul"
                  placeholderTextColor="#636870"
                  style={styles.input}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>DATE</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    onPress={() => setEventDateType('today')}
                    style={[styles.chip, eventDateType === 'today' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'today' && styles.chipTextActive]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEventDateType('tomorrow')}
                    style={[styles.chip, eventDateType === 'tomorrow' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'tomorrow' && styles.chipTextActive]}>
                      Tomorrow
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEventDateType('custom')}
                    style={[styles.chip, eventDateType === 'custom' && styles.chipActive]}>
                    <Text style={[styles.chipText, eventDateType === 'custom' && styles.chipTextActive]}>
                      Custom
                    </Text>
                  </Pressable>
                </View>

                {eventDateType === 'custom' && (
                  <TextInput
                    value={eventCustomDate}
                    onChangeText={setEventCustomDate}
                    placeholder="YYYY-MM-DD (e.g. 2026-09-26)"
                    placeholderTextColor="#636870"
                    style={[styles.input, { marginTop: 10 }]}
                  />
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>START TIME</Text>
                    <TextInput
                      value={eventStartTime}
                      onChangeText={setEventStartTime}
                      placeholder="07:00 PM"
                      placeholderTextColor="#636870"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>END TIME</Text>
                    <TextInput
                      value={eventEndTime}
                      onChangeText={setEventEndTime}
                      placeholder="09:00 PM"
                      placeholderTextColor="#636870"
                      style={styles.input}
                    />
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

                <Pressable onPress={handleCreateEvent} style={styles.submitButton}>
                  <Text style={styles.submitText}>Save Fixed Event</Text>
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
  submitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitText: {
    color: '#0B0D10',
    fontSize: 16,
    fontWeight: '700',
  },
});
