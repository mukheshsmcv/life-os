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
import { getDateString, getTodayString } from '@/lib/date-time';

type DateOption = 'anytime' | 'today' | 'tomorrow' | 'custom';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, addTask, completeTask, deleteTask } = useTasks();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dateOption, setDateOption] = useState<DateOption>('anytime');
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const resetForm = () => {
    setTitle('');
    setDuration('');
    setPriority('medium');
    setDateOption('anytime');
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

    let dateValue: string | null = null;
    if (dateOption === 'today') {
      dateValue = getTodayString();
    } else if (dateOption === 'tomorrow') {
      dateValue = getDateString(1);
    } else if (dateOption === 'custom') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate.trim())) {
        setError('Enter date as YYYY-MM-DD.');
        return;
      }
      dateValue = customDate.trim();
    }

    addTask({ title: title.trim(), durationMinutes, priority, date: dateValue });
    resetForm();
  };

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const pendingCount = pendingTasks.length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'done') return t.status !== 'pending';
    return true;
  });

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
            onPress={() => {
              setError(null);
              setIsFormVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add task">
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {/* ─── Filter Tabs ─── */}
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

            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.buttonRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.optionBtn, priority === p && styles.optionBtnActive]}
                  onPress={() => setPriority(p)}>
                  <Text style={[styles.optionBtnText, priority === p && styles.optionBtnTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>DATE</Text>
            <View style={styles.buttonRow}>
              {(['anytime', 'today', 'tomorrow', 'custom'] as const).map((d) => (
                <Pressable
                  key={d}
                  style={[styles.optionBtn, dateOption === d && styles.optionBtnActive]}
                  onPress={() => setDateOption(d)}>
                  <Text style={[styles.optionBtnText, dateOption === d && styles.optionBtnTextActive]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {dateOption === 'custom' && (
              <TextInput
                value={customDate}
                onChangeText={(text) => {
                  setCustomDate(text);
                  if (error) setError(null);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#4A5060"
                style={styles.input}
              />
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

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

        {/* ─── Task List ─── */}
        <Text style={styles.sectionTitle}>
          {filter === 'all' ? 'All tasks' : filter === 'pending' ? 'Pending tasks' : 'Completed tasks'}
        </Text>

        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tasks found.</Text>
            <Text style={styles.emptySubtitle}>Tap + Add to create your first task.</Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <View key={task.id} style={[styles.taskCard, task.status !== 'pending' && styles.taskCardDone]}>
              <View
                style={[
                  styles.priorityStripe,
                  {
                    backgroundColor:
                      task.priority === 'high'
                        ? '#FF7B7B'
                        : task.priority === 'medium'
                          ? '#A7A0FF'
                          : '#4A5060',
                  },
                ]}
              />
              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, task.status !== 'pending' && styles.taskTitleDone]}>
                  {task.title}
                </Text>
                <Text style={styles.taskMeta}>
                  {task.durationMinutes} min · {task.priority} · {task.date ?? 'Anytime'}
                  {task.status !== 'pending' ? ` · ${task.status}` : ''}
                </Text>
              </View>

              <View style={styles.taskActions}>
                {task.status === 'pending' && (
                  <Pressable
                    style={styles.doneBtn}
                    onPress={() => completeTask(task.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Mark done">
                    <Text style={styles.doneBtnText}>✓</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => deleteTask(task.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete task">
                  <Text style={styles.deleteBtnText}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
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

  form: {
    backgroundColor: '#171A20',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#252932',
    gap: 12,
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
  fieldLabel: { color: '#4A5060', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn: {
    backgroundColor: '#252932',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionBtnActive: { backgroundColor: '#A7A0FF' },
  optionBtnText: { color: '#B0B4BB', fontSize: 13, fontWeight: '600' },
  optionBtnTextActive: { color: '#0B0D10' },
  errorText: { color: '#FF7B7B', fontSize: 13 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  cancelBtnText: { color: '#737983', fontWeight: '600' },
  saveBtn: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { color: '#0B0D10', fontWeight: '700' },

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
  taskTitleDone: { color: '#4A5060', textDecorationLine: 'line-through' },
  taskMeta: { color: '#737983', fontSize: 12, marginTop: 4 },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
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
    backgroundColor: '#252932',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#FF7B7B', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 40, paddingBottom: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#737983', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
