import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskPriority, useTasks } from '@/contexts/tasks-context';

const priorities: TaskPriority[] = ['low', 'medium', 'high'];

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, addTask, completeTask, deleteTask } = useTasks();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dateType, setDateType] = useState<DateType>('anytime');
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const todayStr = getTodayString();

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
    if (!title.trim()) { setError('Enter a task title.'); return; }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }

    addTask({ title: title.trim(), durationMinutes, priority });
    resetForm();
  };

  // Organize tasks
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const doneTasks = tasks.filter((t) => t.status !== 'pending');
  const pendingCount = pendingTasks.length;

  // Filter by active tab
  const todayTasks = pendingTasks.filter((t) => t.date === todayStr || t.date == null);
  const upcomingTasks = pendingTasks.filter((t) => t.date != null && t.date !== todayStr);

  const visiblePendingTasks = filter !== 'done' ? pendingTasks : [];
  const visibleDoneTasks = filter !== 'pending' ? doneTasks : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR PLAN</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Tasks</Text>
              {pendingCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => { setError(null); setIsFormVisible(true); }}
            accessibilityRole="button"
            accessibilityLabel="Add task">
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {/* ─── Filter tabs ─── */}
        <View style={styles.filterRow}>
          {(['all', 'pending', 'done'] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
              accessibilityRole="tab"
              accessibilityLabel={`Show ${f} tasks`}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Add Form ─── */}
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
              placeholderTextColor="#4A5060"
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
              placeholderTextColor="#4A5060"
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.priorityLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorities.map((p) => (
                <Pressable
                  key={value}
                  style={[styles.priorityButton, priority === value && styles.priorityButtonSelected]}
                  onPress={() => setPriority(value)}>
                  <Text style={[styles.priorityText, priority === value && styles.priorityTextSelected]}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.formActions}>
              <Pressable style={styles.cancelBtn} onPress={resetForm} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddTask} accessibilityRole="button">
                <Text style={styles.saveBtnText}>Save task</Text>
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
                {task.durationMinutes} min · {task.priority} priority · {task.status}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  content: { paddingHorizontal: 20, paddingBottom: 36 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 20,
  },
  eyebrow: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  countBadge: {
    backgroundColor: '#A7A0FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: { color: '#0B0D10', fontSize: 12, fontWeight: '700' },
  addButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: { color: '#0B0D10', fontWeight: '700', fontSize: 14 },

  // Filter
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#171A20',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#252932' },
  filterText: { color: '#4A5060', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#E8E9EC' },

  // Form
  form: {
    backgroundColor: '#171A20',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#252932',
    gap: 10,
  },
  formTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: '#0B0D10',
    borderRadius: 11,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#252932',
  },
  priorityLabel: { color: '#4A5060', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    backgroundColor: '#252932',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  priorityBtnText: { color: '#B0B4BB', fontSize: 13, fontWeight: '600' },
  priorityBtnTextActive: { color: '#0B0D10' },
  error: { color: '#FF7B7B', fontSize: 13 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  cancelBtnText: { color: '#737983', fontWeight: '600' },
  saveBtn: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { color: '#0B0D10', fontWeight: '700' },

  // Section label
  sectionLabel: {
    color: '#4A5060',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  priorityLabel: { color: '#9A9EA6', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityButton: { backgroundColor: '#252932', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  priorityButtonSelected: { backgroundColor: '#A7A0FF' },
  priorityText: { color: '#D2D5DA', fontSize: 13, fontWeight: '600' },
  priorityTextSelected: { color: '#171A20' },
  error: { color: '#FF9A9A', fontSize: 13, marginTop: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  cancelButtonText: { color: '#B7BBC2', fontWeight: '600' },
  saveButton: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  saveButtonText: { color: '#0B0D10', fontWeight: '700' },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171A20',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252932',
  },
  taskCardDone: { opacity: 0.5, borderColor: '#1E2228' },
  priorityStripe: { width: 4, alignSelf: 'stretch' },
  taskContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  taskTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
  taskTitleDone: {
    color: '#4A5060',
    textDecorationLine: 'line-through',
  },
  taskMeta: { color: '#737983', fontSize: 12, marginTop: 4 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { color: '#5ECC8B', fontSize: 14, fontWeight: '700' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#4A5060', fontSize: 13 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#737983', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

