"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HomeScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_native_gesture_handler_1 = require("react-native-gesture-handler");
const SuggestionChip_1 = require("@/components/SuggestionChip");
const tasks_context_1 = require("@/contexts/tasks-context");
const date_time_1 = require("@/lib/date-time");
const focus_engine_1 = require("@/lib/focus-engine");
function pad(n) {
    return String(n).padStart(2, '0');
}
function formatTime(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${pad(m)} ${period}`;
}
function formatDuration(minutes) {
    if (minutes < 60)
        return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12)
        return 'Good morning';
    if (h < 17)
        return 'Good afternoon';
    return 'Good evening';
}
const SUGGESTIONS = [
    'Plan my day for high focus',
    'Reschedule missed tasks',
    'Add 30 min workout today',
    'What is on my schedule?',
];
function HomeScreen() {
    const router = (0, expo_router_1.useRouter)();
    const insets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    const { tasks, getEventsForDate, completeTask, skipTask } = (0, tasks_context_1.useTasks)();
    const [currentTime, setCurrentTime] = (0, react_1.useState)(() => new Date());
    const [pausedActivity, setPausedActivity] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const todayStr = (0, date_time_1.getTodayString)();
    const todayEvents = getEventsForDate(todayStr);
    const schedulerEvents = todayEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startMinute: e.startMinute,
        endMinute: e.endMinute,
    }));
    const focus = (0, focus_engine_1.determineTodayFocus)({
        tasks,
        events: schedulerEvents,
        currentDate: currentTime,
        pausedActivityId: pausedActivity?.id ?? null,
    });
    const nowItem = focus.nowItem;
    const isCurrentActivityPaused = focus.isPaused;
    const nowLabel = isCurrentActivityPaused
        ? 'PAUSED'
        : focus.stateKind === 'active_now'
            ? 'NOW'
            : focus.stateKind === 'available_now'
                ? 'NOW'
                : focus.stateKind === 'waiting_upcoming'
                    ? 'UP NEXT'
                    : nowItem
                        ? 'NOT SCHEDULED'
                        : 'DAY COMPLETE';
    const displayedItem = nowItem ?? focus.upNextItems[0];
    const displayedTitle = displayedItem?.title ?? 'Day complete';
    const progressTime = pausedActivity ? pausedActivity.pausedAt : currentTime;
    const progressPercent = displayedItem
        ? Math.min(100, Math.max(0, ((progressTime.getTime() - displayedItem.start.getTime()) /
            (displayedItem.end.getTime() - displayedItem.start.getTime())) *
            100))
        : 0;
    const handleDone = () => {
        if (!nowItem || nowItem.kind !== 'task')
            return;
        completeTask(nowItem.id);
        setPausedActivity(null);
    };
    const handleSkip = () => {
        if (!nowItem || nowItem.kind !== 'task')
            return;
        skipTask(nowItem.id);
        setPausedActivity(null);
    };
    const handlePause = () => {
        if (!nowItem || nowItem.kind !== 'task')
            return;
        setPausedActivity((activity) => activity?.id === nowItem.id ? null : { id: nowItem.id, pausedAt: currentTime });
    };
    const handleChipPress = (prompt) => {
        router.push({
            pathname: '/chat',
            params: { initialPrompt: prompt },
        });
    };
    // ─── Horizontal swipe gesture → Calendar ──────────────────────────────────
    const hasNavigatedRef = (0, react_1.useRef)(false);
    const startXRef = (0, react_1.useRef)(0);
    const startYRef = (0, react_1.useRef)(0);
    const checkSwipeAndNavigate = (translationX, translationY, absoluteX, absoluteY) => {
        const startX = startXRef.current;
        const startY = startYRef.current;
        const totalDx = absoluteX !== undefined && startX > 0 ? absoluteX - startX : translationX;
        const totalDy = absoluteY !== undefined && startY > 0 ? absoluteY - startY : translationY;
        const dx = Math.max(translationX, totalDx);
        const absDy = Math.max(Math.abs(translationY), Math.abs(totalDy));
        const isPositiveSwipe = dx > 0;
        const hasMinDistance = dx >= 60;
        const isClearlyHorizontal = dx > absDy * 1.4;
        if (hasNavigatedRef.current)
            return;
        if (isPositiveSwipe && hasMinDistance && isClearlyHorizontal) {
            hasNavigatedRef.current = true;
            router.push('/calendar');
        }
    };
    const swipeToCalendarGesture = react_native_gesture_handler_1.Gesture.Pan()
        .runOnJS(true)
        .onBegin((event) => {
        hasNavigatedRef.current = false;
        startXRef.current = event.absoluteX;
        startYRef.current = event.absoluteY;
    })
        .onUpdate((event) => {
        checkSwipeAndNavigate(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    })
        .onEnd((event) => {
        checkSwipeAndNavigate(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    });
    return ((0, jsx_runtime_1.jsx)(react_native_gesture_handler_1.GestureDetector, { gesture: swipeToCalendarGesture, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { collapsable: false, style: [styles.container, { paddingTop: insets.top }], children: (0, jsx_runtime_1.jsxs)(react_native_gesture_handler_1.ScrollView, { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.header, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.greeting, children: getGreeting() }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: "Today" })] }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.nowCard, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.nowLabel, children: nowLabel }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.currentTask, children: displayedTitle }), displayedItem ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.time, children: [formatTime(displayedItem.start), " \u2014 ", formatTime(displayedItem.end)] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.progressBg, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                                styles.progressBar,
                                                { width: `${progressPercent}%` },
                                            ] }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.remaining, children: isCurrentActivityPaused
                                            ? 'Activity paused'
                                            : focus.stateKind === 'active_now' || focus.stateKind === 'available_now'
                                                ? formatDuration(Math.max(0, Math.ceil((displayedItem.end.getTime() - currentTime.getTime()) / 60000))) + ' remaining'
                                                : 'Starts in ' + formatDuration(Math.max(0, Math.ceil((displayedItem.start.getTime() - currentTime.getTime()) / 60000))) }), nowItem && nowItem.kind === 'task' && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.actions, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.actionButton, onPress: handleDone, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.actionText, children: "Done" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.secondaryButton, onPress: handlePause, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.secondaryText, children: isCurrentActivityPaused ? 'Resume' : 'Pause' }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.secondaryButton, onPress: handleSkip, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.secondaryText, children: "Can't do this" }) })] }))] })) : ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.remaining, children: "No more activities today" }))] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.aiCard, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { style: styles.aiButton, onPress: () => router.push('/chat'), children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.aiIcon, children: "\u2726" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.aiTextContainer, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.aiTitle, children: "Ask Life OS" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.aiSubtitle, children: "Tell me what you want to achieve today" })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.arrow, children: "\u2192" })] }), (0, jsx_runtime_1.jsx)(react_native_gesture_handler_1.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.chipsContainer, children: SUGGESTIONS.map((suggestion) => ((0, jsx_runtime_1.jsx)(SuggestionChip_1.SuggestionChip, { label: suggestion, onPress: () => handleChipPress(suggestion) }, suggestion))) })] }), focus.upNextItems.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.sectionHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.sectionTitle, children: "Up next" }) }), focus.upNextItems.map((activity) => ((0, jsx_runtime_1.jsx)(ScheduleItem, { start: activity.start, end: activity.end, title: activity.title, duration: activity.durationMinutes }, activity.id)))] })), focus.unscheduledTasks.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.sectionHeader, { marginTop: 16 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.sectionTitle, children: "Not scheduled today" }) }), focus.unscheduledTasks.map((task) => ((0, jsx_runtime_1.jsx)(ScheduleItem, { title: task.title, duration: task.durationMinutes, timeLabel: "Not scheduled" }, task.id)))] })), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { height: 40 } })] }) }) }));
}
// ─── Schedule Item ────────────────────────────────────────────────────────────
function ScheduleItem({ start, end, title, duration, timeLabel, }) {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.scheduleItem, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.itemTime, children: timeLabel ?? (start && end ? formatTime(start) + ' — ' + formatTime(end) : '') }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.itemLine }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.itemContent, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.itemTitle, children: title }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.itemDuration, children: [duration, " min"] })] })] }));
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0D10' },
    content: { padding: 20, paddingBottom: 30 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    greeting: { color: '#8D929A', fontSize: 15 },
    title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 3 },
    nowCard: { backgroundColor: '#171A20', borderRadius: 24, padding: 22, marginBottom: 20 },
    nowLabel: { color: '#A7A0FF', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
    currentTask: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
    time: { color: '#9A9EA6', fontSize: 15, marginTop: 8 },
    progressBg: { height: 5, backgroundColor: '#292D35', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#A7A0FF', borderRadius: 3 },
    remaining: { color: '#777D87', fontSize: 13, marginTop: 9 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 20 },
    actionButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
    actionText: { color: '#0B0D10', fontWeight: '700' },
    secondaryButton: { backgroundColor: '#252932', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
    secondaryText: { color: '#D2D5DA', fontWeight: '600' },
    aiCard: { backgroundColor: '#14171C', borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#20242C' },
    aiButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    aiIcon: { color: '#A7A0FF', fontSize: 22, marginRight: 12 },
    aiTextContainer: { flex: 1 },
    aiTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    aiSubtitle: { color: '#777D87', fontSize: 12, marginTop: 2 },
    arrow: { color: '#9A9EA6', fontSize: 22 },
    chipsContainer: { gap: 8, paddingTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    scheduleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    itemTime: { width: 70, color: '#858A94', fontSize: 12 },
    itemLine: { width: 2, height: 35, backgroundColor: '#30343C', marginRight: 14 },
    itemContent: { flex: 1, backgroundColor: '#14171C', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },
    itemDuration: { color: '#737983', fontSize: 13 },
});
