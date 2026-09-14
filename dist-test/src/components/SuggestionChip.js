"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestionChip = SuggestionChip;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
function SuggestionChip({ label, onPress }) {
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ({ pressed }) => [styles.chip, pressed && styles.chipPressed], onPress: onPress, accessibilityRole: "button", accessibilityLabel: label, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.label, children: label }) }));
}
const styles = react_native_1.StyleSheet.create({
    chip: {
        backgroundColor: '#171A20',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#252932',
    },
    chipPressed: {
        backgroundColor: '#252932',
        borderColor: '#A7A0FF',
    },
    label: {
        color: '#B0B4BB',
        fontSize: 13,
        fontWeight: '500',
    },
});
