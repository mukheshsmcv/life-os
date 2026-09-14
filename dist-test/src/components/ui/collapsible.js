"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collapsible = Collapsible;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_symbols_1 = require("expo-symbols");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const themed_text_1 = require("@/components/themed-text");
const themed_view_1 = require("@/components/themed-view");
const theme_1 = require("@/constants/theme");
const use_theme_1 = require("@/hooks/use-theme");
function Collapsible({ children, title }) {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const theme = (0, use_theme_1.useTheme)();
    return ((0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { style: ({ pressed }) => [styles.heading, pressed && styles.pressedHeading], onPress: () => setIsOpen((value) => !value), children: [(0, jsx_runtime_1.jsx)(themed_view_1.ThemedView, { type: "backgroundElement", style: styles.button, children: (0, jsx_runtime_1.jsx)(expo_symbols_1.SymbolView, { name: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }, size: 14, weight: "bold", tintColor: theme.text, style: { transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] } }) }), (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "small", children: title })] }), isOpen && ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { entering: react_native_reanimated_1.FadeIn.duration(200), children: (0, jsx_runtime_1.jsx)(themed_view_1.ThemedView, { type: "backgroundElement", style: styles.content, children: children }) }))] }));
}
const styles = react_native_1.StyleSheet.create({
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme_1.Spacing.two,
    },
    pressedHeading: {
        opacity: 0.7,
    },
    button: {
        width: theme_1.Spacing.four,
        height: theme_1.Spacing.four,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        marginTop: theme_1.Spacing.three,
        borderRadius: theme_1.Spacing.three,
        marginLeft: theme_1.Spacing.four,
        padding: theme_1.Spacing.four,
    },
});
