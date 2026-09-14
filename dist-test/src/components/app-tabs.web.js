"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppTabs;
exports.TabButton = TabButton;
exports.CustomTabList = CustomTabList;
const jsx_runtime_1 = require("react/jsx-runtime");
const ui_1 = require("expo-router/ui");
const expo_symbols_1 = require("expo-symbols");
const react_native_1 = require("react-native");
const external_link_1 = require("./external-link");
const themed_text_1 = require("./themed-text");
const themed_view_1 = require("./themed-view");
const theme_1 = require("@/constants/theme");
function AppTabs() {
    return ((0, jsx_runtime_1.jsxs)(ui_1.Tabs, { children: [(0, jsx_runtime_1.jsx)(ui_1.TabSlot, { style: { height: '100%' } }), (0, jsx_runtime_1.jsx)(ui_1.TabList, { asChild: true, children: (0, jsx_runtime_1.jsxs)(CustomTabList, { children: [(0, jsx_runtime_1.jsx)(ui_1.TabTrigger, { name: "today", href: '/', asChild: true, children: (0, jsx_runtime_1.jsx)(TabButton, { children: "Today" }) }), (0, jsx_runtime_1.jsx)(ui_1.TabTrigger, { name: "tasks", href: "/tasks", asChild: true, children: (0, jsx_runtime_1.jsx)(TabButton, { children: "Tasks" }) }), (0, jsx_runtime_1.jsx)(ui_1.TabTrigger, { name: "chat", href: "/chat", asChild: true, children: (0, jsx_runtime_1.jsx)(TabButton, { children: "Chat" }) })] }) })] }));
}
function TabButton({ children, isFocused, ...props }) {
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { ...props, style: ({ pressed }) => pressed && styles.pressed, children: (0, jsx_runtime_1.jsx)(themed_view_1.ThemedView, { type: isFocused ? 'backgroundSelected' : 'backgroundElement', style: styles.tabButtonView, children: (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "small", themeColor: isFocused ? 'text' : 'textSecondary', children: children }) }) }));
}
function CustomTabList(props) {
    const scheme = (0, react_native_1.useColorScheme)();
    const colors = theme_1.Colors[scheme === 'unspecified' ? 'light' : scheme];
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { ...props, style: styles.tabListContainer, children: (0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { type: "backgroundElement", style: styles.innerContainer, children: [(0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "smallBold", style: styles.brandText, children: "Life OS" }), props.children, (0, jsx_runtime_1.jsx)(external_link_1.ExternalLink, { href: "https://docs.expo.dev", asChild: true, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { style: styles.externalPressable, children: [(0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "link", children: "Docs" }), (0, jsx_runtime_1.jsx)(expo_symbols_1.SymbolView, { tintColor: colors.text, name: { ios: 'arrow.up.right.square', web: 'link' }, size: 12 })] }) })] }) }));
}
const styles = react_native_1.StyleSheet.create({
    tabListContainer: {
        position: 'absolute',
        width: '100%',
        padding: theme_1.Spacing.three,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    innerContainer: {
        paddingVertical: theme_1.Spacing.two,
        paddingHorizontal: theme_1.Spacing.five,
        borderRadius: theme_1.Spacing.five,
        flexDirection: 'row',
        alignItems: 'center',
        flexGrow: 1,
        gap: theme_1.Spacing.two,
        maxWidth: theme_1.MaxContentWidth,
    },
    brandText: {
        marginRight: 'auto',
    },
    pressed: {
        opacity: 0.7,
    },
    tabButtonView: {
        paddingVertical: theme_1.Spacing.one,
        paddingHorizontal: theme_1.Spacing.three,
        borderRadius: theme_1.Spacing.three,
    },
    externalPressable: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme_1.Spacing.one,
        marginLeft: theme_1.Spacing.three,
    },
});
