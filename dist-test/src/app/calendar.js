"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CalendarScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const tasks_context_1 = require("@/contexts/tasks-context");
const date_time_1 = require("@/lib/date-time");
const scheduler_1 = require("@/lib/scheduler");
// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n) {
    return String(n).padStart(2, '0');
}
function minutesToDisplay(totalMins) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${pad(mins)} ${period}`;
}
function dateToMinutes(date) {
    return date.getHours() * 60 + date.getMinutes();
}
function formatBlockTime(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${pad(m)} ${period}`;
}
function parseDateParts(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return { dow: dows[d.getUTCDay()], day };
}
function buildDateStrip() {
    return Array.from({ length: 7 }, (_, i) => (0, date_time_1.getDateString)(i - 3));
}
function formatDuration(minutes) {
    if (minutes < 60)
        return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function TaskDetailSheet({ item, onClose, onComplete, onSkip }) {
    if (!item)
        return null;
    const canAct = item.status === 'pending';
    return ((0, jsx_runtime_1.jsxs)(react_native_1.Modal, { visible: true, animationType: "slide", transparent: true, onRequestClose: onClose, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ds.overlay, onPress: onClose }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.sheet, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: ds.handle }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.sheetHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.sheetType, children: "TASK" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: onClose, style: ds.closeBtn, accessibilityLabel: "Close", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.closeX, children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.sheetTitle, children: item.title }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.sheetMeta, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.metaItem, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.metaLabel, children: "DURATION" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.metaValue, children: formatDuration(item.durationMinutes) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.metaItem, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.metaLabel, children: "PRIORITY" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [ds.metaValue, item.priority === 'high' ? ds.priHigh : item.priority === 'medium' ? ds.priMedium : ds.priLow], children: item.priority.toUpperCase() })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.metaItem, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.metaLabel, children: "STATUS" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.metaValue, children: item.status.toUpperCase() })] })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.timeBlock, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.timeLabel, children: "SCHEDULED TIME" }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: ds.timeValue, children: [formatBlockTime(item.start), " \u2014 ", formatBlockTime(item.end)] })] }), canAct && ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.actions, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ds.actionPrimary, onPress: () => {
                                    onComplete(item.id);
                                    onClose();
                                }, accessibilityRole: "button", accessibilityLabel: "Mark task done", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.actionPrimaryText, children: "Done" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ds.actionSecondary, onPress: () => {
                                    onSkip(item.id);
                                    onClose();
                                }, accessibilityRole: "button", accessibilityLabel: "Skip task", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.actionSecondaryText, children: "Skip" }) })] }))] })] }));
}
function EventDetailSheet({ item, onClose, onDelete }) {
    if (!item)
        return null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.Modal, { visible: true, animationType: "slide", transparent: true, onRequestClose: onClose, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ds.overlay, onPress: onClose }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.sheet, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: ds.handle }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.sheetHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.sheetType, children: "FIXED EVENT" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: onClose, style: ds.closeBtn, accessibilityLabel: "Close", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.closeX, children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.sheetTitle, children: item.title }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ds.timeBlock, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.timeLabel, children: "EVENT TIME" }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: ds.timeValue, children: [minutesToDisplay(item.startMinute), " \u2014 ", minutesToDisplay(item.endMinute)] }), item.notes ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.notesText, children: item.notes }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: ds.actions, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ds.actionDelete, onPress: () => {
                                onDelete(item.id);
                                onClose();
                            }, accessibilityRole: "button", accessibilityLabel: "Delete event", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ds.actionDeleteText, children: "Delete Event" }) }) })] })] }));
}
const ds = react_native_1.StyleSheet.create({
    overlay: {
        ...react_native_1.StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#171A20',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 14,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#303640',
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sheetType: {
        color: '#A7A0FF',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#252932',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeX: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    sheetTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 20,
        lineHeight: 28,
    },
    sheetMeta: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    metaItem: { gap: 4 },
    metaLabel: {
        color: '#4A5060',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    metaValue: {
        color: '#E8E9EC',
        fontSize: 14,
        fontWeight: '600',
    },
    priHigh: { color: '#FF7B7B' },
    priMedium: { color: '#A7A0FF' },
    priLow: { color: '#737983' },
    timeBlock: {
        backgroundColor: '#0B0D10',
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
        gap: 4,
    },
    timeLabel: {
        color: '#4A5060',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    timeValue: {
        color: '#E8E9EC',
        fontSize: 16,
        fontWeight: '600',
    },
    notesText: {
        color: '#9A9EA6',
        fontSize: 13,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionPrimary: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    actionPrimaryText: { color: '#0B0D10', fontWeight: '700', fontSize: 15 },
    actionSecondary: {
        flex: 1,
        backgroundColor: '#252932',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    actionSecondaryText: { color: '#D2D5DA', fontWeight: '600', fontSize: 15 },
    actionDelete: {
        flex: 1,
        backgroundColor: '#2A1818',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    actionDeleteText: { color: '#FF7B7B', fontWeight: '700', fontSize: 15 },
});
// ─── Main Screen ──────────────────────────────────────────────────────────────
function CalendarScreen() {
    const router = (0, expo_router_1.useRouter)();
    const insets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    console.log('[CALENDAR_DEBUG] CalendarScreen MOUNTED/RENDERED!');
    const { tasks, getEventsForDate, completeTask, skipTask, deleteTask, deleteEvent } = (0, tasks_context_1.useTasks)();
    const todayStr = (0, date_time_1.getTodayString)();
    const dateStrip = buildDateStrip();
    const [selectedDate, setSelectedDate] = (0, react_1.useState)(todayStr);
    const [detailItem, setDetailItem] = (0, react_1.useState)(null);
    const [detailEvent, setDetailEvent] = (0, react_1.useState)(null);
    const [now, setNow] = (0, react_1.useState)(() => new Date());
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);
    const isViewingToday = selectedDate === todayStr;
    const dayEvents = getEventsForDate(selectedDate);
    const explicitDayTasks = tasks.filter((t) => t.date === selectedDate);
    const undatedTasks = isViewingToday ? tasks.filter((t) => t.date == null) : [];
    const dayTasks = [...explicitDayTasks, ...undatedTasks];
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
    const schedule = (0, scheduler_1.scheduleTasks)(dayTasks, scheduler_1.DEFAULT_SCHEDULING_SETTINGS, referenceDate, schedulerEvents);
    const taskMap = new Map(dayTasks.map((t) => [t.id, t]));
    const explicitScheduledBlocks = schedule.blocks.flatMap((block) => {
        if (block.taskId.startsWith('event-'))
            return [];
        const task = taskMap.get(block.taskId);
        return task ? [{ ...task, ...block }] : [];
    });
    const unscheduledTasks = schedule.unscheduledTaskIds.flatMap((id) => {
        const task = taskMap.get(id);
        return task ? [task] : [];
    });
    const totalItemsCount = dayTasks.length + dayEvents.length;
    const currentMinute = dateToMinutes(now);
    const timelineItems = [];
    const allTimed = [
        ...dayEvents.map((e) => ({
            startMinute: e.startMinute ?? 0,
            endMinute: e.endMinute ?? 0,
            item: { kind: 'event', data: e },
        })),
        ...explicitScheduledBlocks.map((b) => ({
            startMinute: b.scheduledStartMinute ?? b.scheduling?.startMinute ?? 0,
            endMinute: (b.scheduledStartMinute ?? b.scheduling?.startMinute ?? 0) + b.durationMinutes,
            item: { kind: 'task', data: b },
        })),
    ].sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
    let lastEnd = scheduler_1.DEFAULT_SCHEDULING_SETTINGS.planningStartMinute;
    for (const entry of allTimed) {
        const gap = (entry.startMinute ?? 0) - lastEnd;
        if (gap >= 30) {
            timelineItems.push({
                kind: 'freetime',
                startMinute: lastEnd,
                endMinute: entry.startMinute,
            });
        }
        timelineItems.push(entry.item);
        lastEnd = Math.max(lastEnd, entry.endMinute);
    }
    const priorityColors = {
        high: '#FF7B7B',
        medium: '#A7A0FF',
        low: '#4A5060',
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.container, { paddingTop: insets.top }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.header, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.headerLeft, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => (router.canGoBack() ? router.back() : router.replace('/')), style: styles.backBtn, accessibilityLabel: "Back to Today", accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.backBtnText, children: "\u2190" }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.eyebrow, children: "SCHEDULE" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: "Calendar" })] })] }), !isViewingToday && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.todayBtn, onPress: () => setSelectedDate(todayStr), accessibilityRole: "button", accessibilityLabel: "Go to today", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.todayBtnText, children: "Today" }) }))] }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: styles.strip, contentContainerStyle: styles.stripContent, children: dateStrip.map((dateStr) => {
                    const { dow, day } = parseDateParts(dateStr);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === todayStr;
                    return ((0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { onPress: () => setSelectedDate(dateStr), style: [styles.dateItem, isSelected && styles.dateItemSelected], accessibilityRole: "button", accessibilityLabel: `${dow} ${day}${isToday ? ' (today)' : ''}`, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.dateDow, isSelected && styles.dateDowSelected], children: dow }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.dateDay, isSelected && styles.dateDaySelected], children: day }), isToday && (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.todayDot, isSelected && styles.todayDotSelected] })] }, dateStr));
                }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.selectedDateRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.selectedDateLabel, children: (0, date_time_1.formatDisplayDate)(selectedDate) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.taskCount, children: totalItemsCount === 0
                            ? 'No plans'
                            : `${totalItemsCount} item${totalItemsCount === 1 ? '' : 's'}` })] }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { contentContainerStyle: styles.content, children: totalItemsCount === 0 ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.emptyState, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.emptyTitle, children: "No plans for this day." }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.emptySubtitle, children: ["Ask Life OS or tap + to add tasks or events for", ' ', (0, date_time_1.formatDisplayDate)(selectedDate).toLowerCase(), "."] })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [timelineItems.map((item, idx) => {
                            if (item.kind === 'freetime') {
                                const gapMins = item.endMinute - item.startMinute;
                                const h = Math.floor(gapMins / 60);
                                const m = gapMins % 60;
                                const label = h > 0 ? (m > 0 ? `${h}h ${m}m free` : `${h}h free`) : `${m}m free`;
                                const showNow = isViewingToday &&
                                    currentMinute >= item.startMinute &&
                                    currentMinute < item.endMinute;
                                return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [showNow && (0, jsx_runtime_1.jsx)(NowIndicator, { currentMinute: currentMinute }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.freeTimeRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.freeTimeTime, children: minutesToDisplay(item.startMinute) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.freeTimeLine }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.freeTimeLabel, children: label })] })] }, `free-${idx}`));
                            }
                            if (item.kind === 'event') {
                                const ev = item.data;
                                const startM = ev.startMinute ?? ev.scheduling?.startMinute ?? 0;
                                const endM = ev.endMinute ?? ev.scheduling?.endMinute ?? 60;
                                const dur = endM - startM;
                                const showNow = isViewingToday &&
                                    currentMinute >= startM &&
                                    currentMinute < endM;
                                return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [showNow && (0, jsx_runtime_1.jsx)(NowIndicator, { currentMinute: currentMinute }), (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { onPress: () => setDetailEvent(ev), style: styles.timelineRow, accessibilityRole: "button", accessibilityLabel: `${ev.title} event detail`, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.timeCol, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.timeText, children: minutesToDisplay(ev.startMinute) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.timeLine }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.timeText, children: minutesToDisplay(ev.endMinute) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.card, styles.eventCard], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.stripe, { backgroundColor: '#FCD34D' }] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardTitleRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.cardTitle, children: ev.title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.eventBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.eventBadgeText, children: "FIXED" }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.cardMeta, children: [dur, " min", ev.notes ? ` · ${ev.notes}` : ''] })] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.deleteBtn, onPress: (e) => {
                                                                e.stopPropagation();
                                                                deleteEvent(ev.id);
                                                            }, accessibilityLabel: "Delete event", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.deleteBtnText, children: "\u2715" }) })] })] })] }, ev.id));
                            }
                            if (item.kind === 'task') {
                                const block = item.data;
                                const isDone = block.status !== 'pending';
                                const showNow = isViewingToday &&
                                    currentMinute >= block.startMinute &&
                                    currentMinute < block.endMinute;
                                return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [showNow && (0, jsx_runtime_1.jsx)(NowIndicator, { currentMinute: currentMinute }), (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { onPress: () => setDetailItem(block), style: styles.timelineRow, accessibilityRole: "button", accessibilityLabel: `${block.title} task detail`, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.timeCol, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.timeText, children: formatBlockTime(block.start) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.timeLine }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.timeText, children: formatBlockTime(block.end) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.card, isDone && styles.cardDone], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                                                styles.stripe,
                                                                { backgroundColor: priorityColors[block.priority] ?? '#4A5060' },
                                                            ] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardTitleRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.cardTitle, isDone && styles.cardTitleDone], children: block.title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.taskBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.taskBadgeText, children: "TASK" }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.cardMeta, children: [formatDuration(block.durationMinutes), " \u00B7 ", block.priority, isDone ? ` · ${block.status}` : ''] })] })] })] })] }, block.id));
                            }
                            return null;
                        }), unscheduledTasks.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.sectionTitle, children: "COULD NOT FIT" }), unscheduledTasks.map((task) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.timelineRow, styles.unscheduledRow], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.timeCol, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.noTimeText, children: "\u2014" }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.card, styles.cardUnscheduled], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                                        styles.stripe,
                                                        { backgroundColor: priorityColors[task.priority] ?? '#4A5060' },
                                                    ] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardBody, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.cardTitle, children: task.title }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.cardMeta, children: [formatDuration(task.durationMinutes), " \u00B7 ", task.priority, " \u00B7 unscheduled"] })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.cardActions, children: [task.status === 'pending' && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.doneBtnSmall, onPress: () => completeTask(task.id), accessibilityLabel: "Complete task", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.doneBtnSmallText, children: "\u2713" }) })), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.deleteBtnSmall, onPress: () => deleteTask(task.id), accessibilityLabel: "Delete task", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.deleteBtnSmallText, children: "\u2715" }) })] })] })] }, task.id)))] })), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { height: 40 } })] })) }), detailItem && ((0, jsx_runtime_1.jsx)(TaskDetailSheet, { item: detailItem, onClose: () => setDetailItem(null), onComplete: completeTask, onSkip: skipTask })), detailEvent && ((0, jsx_runtime_1.jsx)(EventDetailSheet, { item: detailEvent, onClose: () => setDetailEvent(null), onDelete: deleteEvent }))] }));
}
// ─── Now Indicator ────────────────────────────────────────────────────────────
function NowIndicator({ currentMinute }) {
    const h = Math.floor(currentMinute / 60);
    const m = currentMinute % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const label = `NOW · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: ni.row, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: ni.label, children: label }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: ni.line })] }));
}
const ni = react_native_1.StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginVertical: 8,
        gap: 10,
    },
    label: {
        color: '#FF7B7B',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    line: {
        flex: 1,
        height: 1.5,
        backgroundColor: '#FF7B7B',
        opacity: 0.5,
    },
});
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0D10' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#191C22',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backBtnText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
    },
    eyebrow: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginTop: 2 },
    todayBtn: {
        backgroundColor: '#252932',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    todayBtnText: { color: '#B0B4BB', fontSize: 13, fontWeight: '600' },
    strip: { maxHeight: 100 },
    stripContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
    dateItem: {
        width: 56,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#171A20',
    },
    dateItemSelected: { backgroundColor: '#A7A0FF' },
    dateDow: { color: '#4A5060', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
    dateDowSelected: { color: '#0B0D10' },
    dateDay: { color: '#E8E9EC', fontSize: 20, fontWeight: '700', marginTop: 2 },
    dateDaySelected: { color: '#0B0D10' },
    todayDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#A7A0FF',
        marginTop: 4,
    },
    todayDotSelected: { backgroundColor: '#0B0D10' },
    selectedDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    selectedDateLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    taskCount: { color: '#737983', fontSize: 13 },
    content: { paddingHorizontal: 20, paddingBottom: 30 },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
    emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptySubtitle: { color: '#737983', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    freeTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    freeTimeTime: { width: 60, color: '#4A5060', fontSize: 12, fontWeight: '500' },
    freeTimeLine: { flex: 1, height: 1, backgroundColor: '#1E2228' },
    freeTimeLabel: { color: '#4A5060', fontSize: 12, fontWeight: '500' },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    timeCol: { width: 60, alignItems: 'flex-start' },
    timeText: { color: '#737983', fontSize: 12, fontWeight: '500' },
    timeLine: { width: 2, height: 12, backgroundColor: '#252932', marginVertical: 2, marginLeft: 10 },
    noTimeText: { color: '#4A5060', fontSize: 14, fontWeight: '700' },
    card: {
        flex: 1,
        backgroundColor: '#171A20',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#252932',
    },
    cardDone: { opacity: 0.5, borderColor: '#1E2228' },
    eventCard: { borderColor: '#3D3418' },
    cardUnscheduled: { backgroundColor: '#14161B', borderColor: '#20232B' },
    stripe: { width: 4, alignSelf: 'stretch' },
    cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: '#E8E9EC', fontSize: 15, fontWeight: '600', flex: 1 },
    cardTitleDone: { color: '#4A5060', textDecorationLine: 'line-through' },
    eventBadge: {
        backgroundColor: '#3D3418',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    eventBadgeText: { color: '#FCD34D', fontSize: 10, fontWeight: '700' },
    taskBadge: {
        backgroundColor: '#252932',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    taskBadgeText: { color: '#A7A0FF', fontSize: 10, fontWeight: '700' },
    cardMeta: { color: '#737983', fontSize: 12, marginTop: 4 },
    deleteBtn: { padding: 12 },
    deleteBtnText: { color: '#FF7B7B', fontSize: 14, fontWeight: '700' },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
    doneBtnSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#252932',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnSmallText: { color: '#5ECC8B', fontSize: 12, fontWeight: '700' },
    deleteBtnSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#252932',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtnSmallText: { color: '#FF7B7B', fontSize: 12, fontWeight: '700' },
    sectionTitle: { color: '#FF7B7B', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 12 },
    unscheduledRow: { opacity: 0.8 },
});
