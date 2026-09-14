"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddActionModal = AddActionModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const tasks_context_1 = require("@/contexts/tasks-context");
const date_time_1 = require("@/lib/date-time");
function AddActionModal({ visible, onClose }) {
    const { addTask, addEvent } = (0, tasks_context_1.useTasks)();
    const [activeTab, setActiveTab] = (0, react_1.useState)('task');
    const [formError, setFormError] = (0, react_1.useState)(null);
    // Task form state
    const [taskTitle, setTaskTitle] = (0, react_1.useState)('');
    const [taskDuration, setTaskDuration] = (0, react_1.useState)(60);
    const [taskCustomDuration, setTaskCustomDuration] = (0, react_1.useState)('');
    const [taskDateType, setTaskDateType] = (0, react_1.useState)('today');
    const [taskCustomDate, setTaskCustomDate] = (0, react_1.useState)('');
    const [taskPriority, setTaskPriority] = (0, react_1.useState)('medium');
    // Event form state
    const [eventTitle, setEventTitle] = (0, react_1.useState)('');
    const [eventDateType, setEventDateType] = (0, react_1.useState)('today');
    const [eventCustomDate, setEventCustomDate] = (0, react_1.useState)('');
    const [eventStartTime, setEventStartTime] = (0, react_1.useState)('07:00 PM');
    const [eventEndTime, setEventEndTime] = (0, react_1.useState)('09:00 PM');
    const [eventNotes, setEventNotes] = (0, react_1.useState)('');
    const todayStr = (0, date_time_1.getTodayString)();
    const tomorrowStr = (0, date_time_1.getDateString)(1);
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
        setEventStartTime('07:00 PM');
        setEventEndTime('09:00 PM');
        setEventNotes('');
    };
    const switchTab = (tab) => {
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
        let finalDate = null;
        if (taskDateType === 'today') {
            finalDate = todayStr;
        }
        else if (taskDateType === 'tomorrow') {
            finalDate = tomorrowStr;
        }
        else if (taskDateType === 'custom') {
            const trimmedDate = taskCustomDate.trim();
            if (!trimmedDate || !(0, date_time_1.isValidDateString)(trimmedDate)) {
                setFormError('Enter a valid date in YYYY-MM-DD format (e.g. 2026-09-26).');
                return;
            }
            finalDate = trimmedDate;
        }
        addTask({
            title: taskTitle.trim(),
            durationMinutes: finalDuration,
            priority: taskPriority,
            date: finalDate,
            scheduling: {
                mode: 'flexible',
                date: finalDate,
                startMinute: null,
                endMinute: null,
            },
        });
        resetForm();
        onClose();
    };
    function parseTimeToMinutes(timeStr) {
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match)
            return null;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59)
            return null;
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours < 12)
            hours += 12;
        if (period === 'AM' && hours === 12)
            hours = 0;
        return hours * 60 + minutes;
    }
    const handleCreateEvent = () => {
        setFormError(null);
        if (!eventTitle.trim()) {
            setFormError('Event title is required.');
            return;
        }
        let finalDate = todayStr;
        if (eventDateType === 'tomorrow') {
            finalDate = tomorrowStr;
        }
        else if (eventDateType === 'custom') {
            const trimmedDate = eventCustomDate.trim();
            if (!trimmedDate || !(0, date_time_1.isValidDateString)(trimmedDate)) {
                setFormError('Enter a valid date in YYYY-MM-DD format (e.g. 2026-09-26).');
                return;
            }
            finalDate = trimmedDate;
        }
        const startMin = parseTimeToMinutes(eventStartTime);
        if (startMin === null) {
            setFormError('Enter a valid start time (e.g. 07:00 PM).');
            return;
        }
        const endMin = parseTimeToMinutes(eventEndTime);
        if (endMin === null) {
            setFormError('Enter a valid end time (e.g. 09:00 PM).');
            return;
        }
        if (endMin <= startMin) {
            setFormError('End time must be after start time.');
            return;
        }
        addEvent({
            title: eventTitle.trim(),
            date: finalDate,
            startMinute: startMin,
            endMinute: endMin,
            notes: eventNotes.trim() || undefined,
        });
        resetForm();
        onClose();
    };
    return ((0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: visible, animationType: "slide", transparent: true, onRequestClose: onClose, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.overlay, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.modalCard, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.header, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.tabSelector, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => switchTab('task'), style: [styles.tabButton, activeTab === 'task' && styles.tabButtonActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.tabText, activeTab === 'task' && styles.tabTextActive], children: "\u2795 Task" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => switchTab('event'), style: [styles.tabButton, activeTab === 'event' && styles.tabButtonActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.tabText, activeTab === 'event' && styles.tabTextActive], children: "\uD83D\uDCC5 Fixed Event" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: onClose, style: styles.closeButton, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.closeText, children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { style: styles.formContent, keyboardShouldPersistTaps: "handled", children: activeTab === 'task' ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.formGroup, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: "TASK TITLE" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: taskTitle, onChangeText: (text) => {
                                        setTaskTitle(text);
                                        if (formError)
                                            setFormError(null);
                                    }, placeholder: "e.g. Study Pathology", placeholderTextColor: "#636870", style: styles.input }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.label, { marginTop: 16 }], children: "DURATION (MINUTES)" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.chipRow, children: [15, 30, 45, 60, 90, 120].map((mins) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                            setTaskDuration(mins);
                                            setTaskCustomDuration('');
                                            if (formError)
                                                setFormError(null);
                                        }, style: [
                                            styles.chip,
                                            taskDuration === mins && !taskCustomDuration && styles.chipActive,
                                        ], children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [
                                                styles.chipText,
                                                taskDuration === mins && !taskCustomDuration && styles.chipTextActive,
                                            ], children: [mins, "m"] }) }, mins))) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.label, { marginTop: 16 }], children: "DATE" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.chipRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setTaskDateType('anytime');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, taskDateType === 'anytime' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, taskDateType === 'anytime' && styles.chipTextActive], children: "Anytime" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setTaskDateType('today');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, taskDateType === 'today' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, taskDateType === 'today' && styles.chipTextActive], children: "Today" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setTaskDateType('tomorrow');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, taskDateType === 'tomorrow' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, taskDateType === 'tomorrow' && styles.chipTextActive], children: "Tomorrow" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setTaskDateType('custom');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, taskDateType === 'custom' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, taskDateType === 'custom' && styles.chipTextActive], children: "Custom" }) })] }), taskDateType === 'custom' && ((0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: taskCustomDate, onChangeText: (text) => {
                                        setTaskCustomDate(text);
                                        if (formError)
                                            setFormError(null);
                                    }, placeholder: "YYYY-MM-DD (e.g. 2026-09-26)", placeholderTextColor: "#636870", style: [styles.input, { marginTop: 10 }] })), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.label, { marginTop: 16 }], children: "PRIORITY" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.chipRow, children: ['low', 'medium', 'high'].map((p) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                            setTaskPriority(p);
                                            if (formError)
                                                setFormError(null);
                                        }, style: [styles.chip, taskPriority === p && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, taskPriority === p && styles.chipTextActive], children: p.toUpperCase() }) }, p))) }), formError && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: formError }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: handleCreateTask, style: styles.submitButton, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.submitText, children: "Save Task" }) })] })) : ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.formGroup, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: "EVENT TITLE" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: eventTitle, onChangeText: (text) => {
                                        setEventTitle(text);
                                        if (formError)
                                            setFormError(null);
                                    }, placeholder: "e.g. Dinner with Rahul", placeholderTextColor: "#636870", style: styles.input }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.label, { marginTop: 16 }], children: "DATE" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.chipRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setEventDateType('today');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, eventDateType === 'today' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, eventDateType === 'today' && styles.chipTextActive], children: "Today" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setEventDateType('tomorrow');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, eventDateType === 'tomorrow' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, eventDateType === 'tomorrow' && styles.chipTextActive], children: "Tomorrow" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => {
                                                setEventDateType('custom');
                                                if (formError)
                                                    setFormError(null);
                                            }, style: [styles.chip, eventDateType === 'custom' && styles.chipActive], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.chipText, eventDateType === 'custom' && styles.chipTextActive], children: "Custom" }) })] }), eventDateType === 'custom' && ((0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: eventCustomDate, onChangeText: (text) => {
                                        setEventCustomDate(text);
                                        if (formError)
                                            setFormError(null);
                                    }, placeholder: "YYYY-MM-DD (e.g. 2026-09-26)", placeholderTextColor: "#636870", style: [styles.input, { marginTop: 10 }] })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', gap: 12, marginTop: 16 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: "START TIME" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: eventStartTime, onChangeText: (text) => {
                                                        setEventStartTime(text);
                                                        if (formError)
                                                            setFormError(null);
                                                    }, placeholder: "07:00 PM", placeholderTextColor: "#636870", style: styles.input })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: "END TIME" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: eventEndTime, onChangeText: (text) => {
                                                        setEventEndTime(text);
                                                        if (formError)
                                                            setFormError(null);
                                                    }, placeholder: "09:00 PM", placeholderTextColor: "#636870", style: styles.input })] })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.label, { marginTop: 16 }], children: "NOTES (OPTIONAL)" }), (0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: eventNotes, onChangeText: setEventNotes, placeholder: "e.g. Dr. Sharma Clinic", placeholderTextColor: "#636870", style: styles.input }), formError && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.errorText, children: formError }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: handleCreateEvent, style: styles.submitButton, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.submitText, children: "Save Fixed Event" }) })] })) })] }) }) }));
}
const styles = react_native_1.StyleSheet.create({
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
});
