"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThinkingIndicator = ThinkingIndicator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const PHASES = ['Thinking', 'Planning', 'Working on it'];
function ThinkingIndicator() {
    const [phase, setPhase] = (0, react_1.useState)(0);
    const dot1 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    const dot2 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    const dot3 = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    (0, react_1.useEffect)(() => {
        const phaseTimer = setInterval(() => {
            setPhase((p) => (p + 1) % PHASES.length);
        }, 2200);
        return () => clearInterval(phaseTimer);
    }, []);
    (0, react_1.useEffect)(() => {
        const animate = (dot, delay) => react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.delay(delay),
            react_native_1.Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
            react_native_1.Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
            react_native_1.Animated.delay(600),
        ]));
        const a1 = animate(dot1, 0);
        const a2 = animate(dot2, 150);
        const a3 = animate(dot3, 300);
        a1.start();
        a2.start();
        a3.start();
        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, [dot1, dot2, dot3]);
    const dotStyle = (anim) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
    });
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.container, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.bubble, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: PHASES[phase] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.dots, children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [styles.dot, dotStyle(dot1)] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [styles.dot, dotStyle(dot2)] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [styles.dot, dotStyle(dot3)] })] })] }) }));
}
const styles = react_native_1.StyleSheet.create({
    container: { alignItems: 'flex-start', paddingHorizontal: 20 },
    bubble: {
        backgroundColor: '#171A20',
        borderRadius: 18,
        borderTopLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: '80%',
    },
    label: { color: '#737983', fontSize: 14, fontWeight: '500', fontStyle: 'italic' },
    dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#A7A0FF',
    },
});
