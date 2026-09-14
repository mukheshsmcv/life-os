"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyState = EmptyState;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const DEFAULT_PROMPTS = [
    { label: 'Plan my day', text: 'Plan my day' },
    { label: 'Study anatomy tomorrow', text: 'I need to study anatomy tomorrow for an hour' },
    { label: "What's next?", text: "What's next on my schedule?" },
    { label: 'Find free time', text: 'Find free time in my schedule today' },
];
function EmptyState({ onSelectPrompt }) {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.logoArea, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.logoMark, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.logoSymbol, children: "\u2726" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.brandName, children: "Life OS" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.tagline, children: "Tell me what you want to get done." })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.promptsArea, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.promptsLabel, children: "Try asking" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.promptGrid, children: DEFAULT_PROMPTS.map((prompt) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed], onPress: () => onSelectPrompt(prompt.text), accessibilityRole: "button", accessibilityLabel: `Try: ${prompt.label}`, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.promptText, children: prompt.label }) }, prompt.label))) })] })] }));
}
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    logoArea: {
        alignItems: 'center',
        marginBottom: 52,
    },
    logoMark: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#171A20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#252932',
    },
    logoSymbol: {
        color: '#A7A0FF',
        fontSize: 22,
    },
    brandName: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    tagline: {
        color: '#737983',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    promptsArea: {
        width: '100%',
        alignItems: 'center',
    },
    promptsLabel: {
        color: '#4A5060',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 14,
        textTransform: 'uppercase',
    },
    promptGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
    },
    promptChip: {
        backgroundColor: '#171A20',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#252932',
    },
    promptChipPressed: {
        backgroundColor: '#252932',
        borderColor: '#A7A0FF',
    },
    promptText: {
        color: '#B0B4BB',
        fontSize: 13,
        fontWeight: '500',
    },
});
