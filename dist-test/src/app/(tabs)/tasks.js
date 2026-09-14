"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TasksScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const tasks_context_1 = require("@/contexts/tasks-context");
const date_time_1 = require("@/lib/date-time");
const PRIORITIES = ['low', 'medium', 'high'];
function TasksScreen() {
    const insets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    const { tasks, addTask, completeTask, deleteTask } = (0, tasks_context_1.useTasks)();
    const [isFormVisible, setIsFormVisible] = (0, react_1.useState)(false);
    const [title, setTitle] = (0, react_1.useState)('');
    const [duration, setDuration] = (0, react_1.useState)('');
    const [priority, setPriority] = (0, react_1.useState)('medium');
    const [dateOption, setDateOption] = (0, react_1.useState)('anytime');
    const [customDate, setCustomDate] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)(null);
    const [filter, setFilter] = (0, react_1.useState)('all');
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
        let dateValue = null;
        if (dateOption === 'today') {
            dateValue = (0, date_time_1.getTodayString)();
        }
        else if (dateOption === 'tomorrow') {
            dateValue = (0, date_time_1.getDateString)(1);
        }
        else if (dateOption === 'custom') {
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
        if (filter === 'pending')
            return t.status === 'pending';
        if (filter === 'done')
            return t.status !== 'pending';
        return true;
    });
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.container, { paddingTop: insets.top }], children: (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: styles.content, keyboardShouldPersistTaps: "handled", showsVerticalScrollIndicator: false, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.header, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.eyebrow, children: "YOUR PLAN" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.titleRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: "Tasks" }), pendingCount > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.countBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.countBadgeText, children: pendingCount }) }))] })] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.addButton, onPress: () => {
                                setError(null);
                                setIsFormVisible(true);
                            }, accessibilityRole: "button", accessibilityLabel: "Add task", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.addButtonText, children: "+ Add" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.filterRow, children: ['all', 'pending', 'done'].map((f) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: [styles.filterTab, filter === f && styles.filterTabActive], onPress: () => setFilter(f), accessibilityRole: "tab", accessibilityLabel: `Show ${f} tasks`, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.filterText, filter === f && styles.filterTextActive], children: f.charAt(0).toUpperCase() + f.slice(1) }) }, f))) }), isFormVisible && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.form, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.formTitle, children: "New task" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: title, onChangeText: (text) => {
                                setTitle(text);
                                if (error)
                                    setError(null);
                            }, placeholder: "Task title", placeholderTextColor: "#4A5060", style: styles.input, autoFocus: true }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: duration, onChangeText: (text) => {
                                setDuration(text);
                                if (error)
                                    setError(null);
                            }, placeholder: "Duration in minutes", placeholderTextColor: "#4A5060", keyboardType: "number-pad", style: styles.input }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "PRIORITY" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.buttonRow, children: PRIORITIES.map((p) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: [styles.optionBtn, priority === p && styles.optionBtnActive], onPress: () => setPriority(p), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.optionBtnText, priority === p && styles.optionBtnTextActive], children: p.charAt(0).toUpperCase() + p.slice(1) }) }, p))) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fieldLabel, children: "DATE" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.buttonRow, children: ['anytime', 'today', 'tomorrow', 'custom'].map((d) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: [styles.optionBtn, dateOption === d && styles.optionBtnActive], onPress: () => setDateOption(d), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.optionBtnText, dateOption === d && styles.optionBtnTextActive], children: d.charAt(0).toUpperCase() + d.slice(1) }) }, d))) }), dateOption === 'custom' && ((0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: customDate, onChangeText: (text) => {
                                setCustomDate(text);
                                if (error)
                                    setError(null);
                            }, placeholder: "YYYY-MM-DD", placeholderTextColor: "#4A5060", style: styles.input })), error && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: error }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.formActions, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.cancelBtn, onPress: resetForm, accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.cancelBtnText, children: "Cancel" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.saveBtn, onPress: handleAddTask, accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.saveBtnText, children: "Save task" }) })] })] })), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.sectionTitle, children: filter === 'all' ? 'All tasks' : filter === 'pending' ? 'Pending tasks' : 'Completed tasks' }), filteredTasks.length === 0 ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.emptyState, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.emptyTitle, children: "No tasks found." }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.emptySubtitle, children: "Tap + Add to create your first task." })] })) : (filteredTasks.map((task) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.taskCard, task.status !== 'pending' && styles.taskCardDone], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                styles.priorityStripe,
                                {
                                    backgroundColor: task.priority === 'high'
                                        ? '#FF7B7B'
                                        : task.priority === 'medium'
                                            ? '#A7A0FF'
                                            : '#4A5060',
                                },
                            ] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.taskContent, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.taskTitle, task.status !== 'pending' && styles.taskTitleDone], children: task.title }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.taskMeta, children: [task.durationMinutes, " min \u00B7 ", task.priority, " \u00B7 ", task.date ?? 'Anytime', task.status !== 'pending' ? ` · ${task.status}` : ''] })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.taskActions, children: [task.status === 'pending' && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.doneBtn, onPress: () => completeTask(task.id), accessibilityRole: "button", accessibilityLabel: "Mark done", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.doneBtnText, children: "\u2713" }) })), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.deleteBtn, onPress: () => deleteTask(task.id), accessibilityRole: "button", accessibilityLabel: "Delete task", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.deleteBtnText, children: "\u2715" }) })] })] }, task.id)))), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { height: 40 } })] }) }));
}
const styles = react_native_1.StyleSheet.create({
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
