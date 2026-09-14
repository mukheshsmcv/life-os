"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppTabs;
const jsx_runtime_1 = require("react/jsx-runtime");
const unstable_native_tabs_1 = require("expo-router/unstable-native-tabs");
const react_native_1 = require("react-native");
const theme_1 = require("@/constants/theme");
function AppTabs() {
    const scheme = (0, react_native_1.useColorScheme)();
    const colors = theme_1.Colors[scheme === 'unspecified' ? 'light' : scheme];
    return ((0, jsx_runtime_1.jsxs)(unstable_native_tabs_1.NativeTabs, { backgroundColor: colors.background, indicatorColor: colors.backgroundElement, labelStyle: { selected: { color: colors.text } }, children: [(0, jsx_runtime_1.jsxs)(unstable_native_tabs_1.NativeTabs.Trigger, { name: "index", children: [(0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Label, { children: "Today" }), (0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Icon, { src: require('@/assets/images/tabIcons/home.png'), renderingMode: "template" })] }), (0, jsx_runtime_1.jsxs)(unstable_native_tabs_1.NativeTabs.Trigger, { name: "tasks", children: [(0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Label, { children: "Tasks" }), (0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Icon, { src: require('@/assets/images/tabIcons/explore.png'), renderingMode: "template" })] }), (0, jsx_runtime_1.jsxs)(unstable_native_tabs_1.NativeTabs.Trigger, { name: "chat", children: [(0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Label, { children: "Chat" }), (0, jsx_runtime_1.jsx)(unstable_native_tabs_1.NativeTabs.Trigger.Icon, { src: require('@/assets/images/tabIcons/explore.png'), renderingMode: "template" })] })] }));
}
