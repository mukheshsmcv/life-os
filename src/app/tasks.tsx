import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TaskPriority, useTasks } from '@/contexts/tasks-context';
import {
  formatDisplayDate,
  getDateString,
  getTodayString,
  isValidDateString,
} from '@/lib/date-time';

const priorities: TaskPriority[] = ['low', 'medium', 'high'];
type DateType = 'anytime' | 'today' | 'tomorrow' | 'custom';

export default function TasksScreen() {
  const { tasks, addTask, completeTask, deleteTask } = useTasks();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dateType, setDateType] = useState<DateType>('anytime');
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDuration('');
    setPriority('medium');
    setDateType('anytime');
    setCustomDate('');
    setError(null);
    setIsFormVisible(false);
  };

  const handleAddTask = () => {
    setError(null);
    const durationMinutes = Number(duration);

    if (!title.trim()) {
      setError('Enter a task title.');
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }

    let finalDate: string | null = null;
    if (dateType === 'today') {
      finalDate = getTodayString();
    } else if (dateType === 'tomorrow') {
      finalDate = getDateString(1);
    } else if (dateType === 'custom') {
      const trimmed = customDate.trim();
      if (!trimmed || !isValidDateString(trimmed)) {
        setError('Enter a valid date in YYYY-MM-DD format (e.g. 2026-09-26).');
        return;
      }
      finalDate = trimmed;
    }

    addTask({ title: title.trim(), durationMinutes, priority, date: finalDate });
    resetForm();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR PLAN</Text>
            <Text style={styles.title}>Tasks</Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => {
              setError(null);
              setIsFormVisible(true);
            }}>
            <Text style={styles.addButtonText}>+ Add Task</Text>
          </Pressable>
        </View>

        {isFormVisible && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New task</Text>
            <TextInput
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (error) setError(null);
              }}
              placeholder="Task title"
              placeholderTextColor="#737983"
              style={styles.input}
              autoFocus
            />
            <TextInput
              value={duration}
              onChangeText={(text) => {
                setDuration(text);
                if (error) setError(null);
              }}
              placeholder="Duration in minutes"
              placeholderTextColor="#737983"
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Date</Text>
            <View style={styles.chipRow}>
              {(['anytime', 'today', 'tomorrow', 'custom'] as DateType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, dateType === type && styles.chipSelected]}
                  onPress={() => {
                    setDateType(type);
                    if (error) setError(null);
                  }}>
                  <Text style={[styles.chipText, dateType === type && styles.chipTextSelected]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {dateType === 'custom' && (
              <TextInput
                value={customDate}
                onChangeText={(text) => {
                  setCustomDate(text);
                  if (error) setError(null);
                }}
                placeholder="YYYY-MM-DD (e.g. 2026-09-26)"
                placeholderTextColor="#737983"
                style={[styles.input, { marginTop: 8 }]}
              />
            )}

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorities.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.priorityButton, priority === value && styles.priorityButtonSelected]}
                  onPress={() => {
                    setPriority(value);
                    if (error) setError(null);
                  }}>
                  <Text style={[styles.priorityText, priority === value && styles.priorityTextSelected]}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.formActions}>
              <Pressable style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleAddTask}>
                <Text style={styles.saveButtonText}>Save task</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>All tasks</Text>

        {tasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskContent}>
              <Text style={[styles.taskTitle, task.status !== 'pending' && styles.taskTitleCompleted]}>
                {task.title}
              </Text>
              <Text style={styles.taskMeta}>
                {task.durationMinutes} min · {task.priority} priority · {task.date ? formatDisplayDate(task.date) : 'Anytime'} · {task.status}
              </Text>
            </View>

            <View style={styles.taskActions}>
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
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  content: { padding: 20, paddingBottom: 36 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  eyebrow: { color: '#A7A0FF', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginTop: 4 },
  addButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  addButtonText: { color: '#0B0D10', fontWeight: '700' },
  form: { backgroundColor: '#171A20', borderRadius: 20, padding: 18, marginBottom: 30 },
  formTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '700', marginBottom: 14 },
  input: {
    backgroundColor: '#252932',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  fieldLabel: { color: '#9A9EA6', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  chip: { backgroundColor: '#252932', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#A7A0FF' },
  chipText: { color: '#D2D5DA', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#171A20', fontWeight: '700' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityButton: { backgroundColor: '#252932', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  priorityButtonSelected: { backgroundColor: '#A7A0FF' },
  priorityText: { color: '#D2D5DA', fontSize: 13, fontWeight: '600' },
  priorityTextSelected: { color: '#171A20', fontWeight: '700' },
  error: { color: '#FF9A9A', fontSize: 13, marginTop: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelButtonText: { color: '#B7BBC2', fontWeight: '600' },
  saveButton: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  saveButtonText: { color: '#0B0D10', fontWeight: '700' },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  taskCard: {
    backgroundColor: '#171A20',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskContent: { flex: 1 },
  taskTitle: { color: '#E8E9EC', fontSize: 16, fontWeight: '600' },
  taskTitleCompleted: { color: '#858A94', textDecorationLine: 'line-through' },
  taskMeta: { color: '#858A94', fontSize: 12, marginTop: 5 },
  taskActions: { alignItems: 'flex-end', gap: 8 },
  completeButton: { backgroundColor: '#A7A0FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  completeButtonText: { color: '#171A20', fontSize: 12, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 5, paddingVertical: 3 },
  deleteButtonText: { color: '#FF9A9A', fontSize: 12, fontWeight: '600' },
});

