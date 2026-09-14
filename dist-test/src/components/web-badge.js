"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebBadge = WebBadge;
const jsx_runtime_1 = require("react/jsx-runtime");
const package_json_1 = require("expo/package.json");
const expo_image_1 = require("expo-image");
const react_native_1 = require("react-native");
const themed_text_1 = require("./themed-text");
const themed_view_1 = require("./themed-view");
const theme_1 = require("@/constants/theme");
function WebBadge() {
    const scheme = (0, react_native_1.useColorScheme)();
    return ((0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "code", themeColor: "textSecondary", style: styles.versionText, children: ["v", package_json_1.version] }), (0, jsx_runtime_1.jsx)(expo_image_1.Image, { source: scheme === 'dark'
                    ? require('@/assets/images/expo-badge-white.png')
                    : require('@/assets/images/expo-badge.png'), style: styles.badgeImage })] }));
}
const styles = react_native_1.StyleSheet.create({
    container: {
        padding: theme_1.Spacing.five,
        alignItems: 'center',
        gap: theme_1.Spacing.two,
    },
    versionText: {
        textAlign: 'center',
    },
    badgeImage: {
        width: 123,
        aspectRatio: 123 / 24,
    },
});
