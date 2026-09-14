"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HintRow = HintRow;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const themed_text_1 = require("./themed-text");
const themed_view_1 = require("./themed-view");
const theme_1 = require("@/constants/theme");
function HintRow({ title = 'Try editing', hint = 'app/index.tsx' }) {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.stepRow, children: [(0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "small", children: title }), (0, jsx_runtime_1.jsx)(themed_view_1.ThemedView, { type: "backgroundSelected", style: styles.codeSnippet, children: (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { themeColor: "textSecondary", children: hint }) })] }));
}
const styles = react_native_1.StyleSheet.create({
    stepRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    codeSnippet: {
        borderRadius: theme_1.Spacing.two,
        paddingVertical: theme_1.Spacing.half,
        paddingHorizontal: theme_1.Spacing.two,
    },
});
