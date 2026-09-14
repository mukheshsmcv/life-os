"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIActionCard = AIActionCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const CARD_CONFIG = {
    task_created: { label: 'TASK CREATED', accentColor: '#A7A0FF', labelColor: '#A7A0FF' },
    task_completed: { label: 'TASK COMPLETED', accentColor: '#5ECC8B', labelColor: '#5ECC8B' },
    task_skipped: { label: 'TASK SKIPPED', accentColor: '#737983', labelColor: '#737983' },
    task_deleted: { label: 'TASK REMOVED', accentColor: '#FF7B7B', labelColor: '#FF7B7B' },
    task_updated: { label: 'TASK UPDATED', accentColor: '#A7A0FF', labelColor: '#A7A0FF' },
    day_replanned: { label: 'DAY REPLANNED', accentColor: '#A7A0FF', labelColor: '#A7A0FF' },
    clarification: { label: 'CLARIFICATION NEEDED', accentColor: '#FCD34D', labelColor: '#FCD34D' },
};
function formatDate(dateStr) {
    if (!dateStr)
        return 'Today';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (dateStr === todayStr)
        return 'Today';
    if (dateStr === tomorrowStr)
        return 'Tomorrow';
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}, ${year}`;
}
function formatDuration(minutes) {
    if (!minutes)
        return '';
    if (minutes < 60)
        return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function AIActionCard({ type, title, durationMinutes, date, priority, changeCount }) {
    const config = CARD_CONFIG[type];
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.card, { borderLeftColor: config.accentColor }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.cardLabel, { color: config.labelColor }], children: config.label }), type === 'task_created' || type === 'task_updated' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [title && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: title }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.metaRow, children: [durationMinutes ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.meta, children: formatDuration(durationMinutes) })) : null, date !== undefined && ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.meta, children: formatDate(date) })), priority && ((0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: styles.meta, children: [priority, " priority"] }))] })] })) : type === 'task_completed' || type === 'task_skipped' || type === 'task_deleted' ? (title ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: title }) : null) : type === 'day_replanned' ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.meta, children: changeCount !== undefined ? `${changeCount} schedule change${changeCount === 1 ? '' : 's'} made` : 'Schedule updated' })) : null] }));
}
const styles = react_native_1.StyleSheet.create({
    card: {
        backgroundColor: '#0F1115',
        borderRadius: 12,
        borderLeftWidth: 3,
        padding: 12,
        marginTop: 8,
        gap: 4,
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
    title: {
        color: '#E8E9EC',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 2,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2,
    },
    meta: {
        color: '#737983',
        fontSize: 12,
        fontWeight: '500',
    },
});
