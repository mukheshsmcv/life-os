"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = ChatMessage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const AIActionCard_1 = require("./AIActionCard");
function formatNotice(notice, type) {
    // Convert raw technical notices to user-friendly messages
    if (!notice)
        return notice;
    const lower = notice.toLowerCase();
    if (lower.includes('server offline') || lower.includes('server unreachable') || lower.includes('network')) {
        return 'AI is temporarily unavailable. Basic mode is active.';
    }
    if (lower.includes('rate') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
        return 'AI is busy right now. Basic mode is active.';
    }
    if (lower.includes('gemini') || lower.includes('api error') || lower.includes('backend error')) {
        return 'AI had an issue. Basic mode is active.';
    }
    if (lower.includes('malformed') || lower.includes('schema mismatch')) {
        return 'AI response was unexpected. Basic mode is active.';
    }
    if (lower.includes('basic command mode') || lower.includes('basic mode')) {
        return 'Running in basic mode';
    }
    return notice;
}
function ChatMessage({ message }) {
    const isUser = message.sender === 'user';
    if (isUser) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.userRow, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.userBubble, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.userText, children: message.text }) }) }));
    }
    // Assistant message
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.assistantRow, children: [message.notice ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.noticeRow, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.noticeBadge, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.noticeDot, children: "\u26A1" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.noticeText, children: formatNotice(message.notice, message.noticeType) })] }) })) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.assistantBubble, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.assistantText, children: message.text }), message.actions && message.actions.length > 0 && ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.cardsContainer, children: message.actions.map((action, i) => ((0, jsx_runtime_1.jsx)(AIActionCard_1.AIActionCard, { type: action.cardType, title: action.title, durationMinutes: action.durationMinutes, date: action.date, priority: action.priority, changeCount: action.changeCount }, i))) }))] })] }));
}
const styles = react_native_1.StyleSheet.create({
    // User
    userRow: {
        alignItems: 'flex-end',
    },
    userBubble: {
        backgroundColor: '#A7A0FF',
        borderRadius: 18,
        borderTopRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 11,
        maxWidth: '82%',
    },
    userText: {
        color: '#0B0D10',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 21,
    },
    // Assistant
    assistantRow: {
        alignItems: 'flex-start',
        gap: 4,
    },
    assistantBubble: {
        backgroundColor: '#171A20',
        borderRadius: 18,
        borderTopLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        maxWidth: '92%',
    },
    assistantText: {
        color: '#E8E9EC',
        fontSize: 15,
        lineHeight: 22,
    },
    cardsContainer: {
        marginTop: 4,
        gap: 6,
    },
    // Notice
    noticeRow: {
        alignSelf: 'flex-start',
        marginBottom: 2,
    },
    noticeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#1E1A0A',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: '#3A2F10',
    },
    noticeDot: {
        fontSize: 11,
    },
    noticeText: {
        color: '#B8960C',
        fontSize: 11,
        fontWeight: '600',
    },
});
