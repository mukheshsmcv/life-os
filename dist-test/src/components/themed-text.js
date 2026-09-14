"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemedText = ThemedText;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const theme_1 = require("@/constants/theme");
const use_theme_1 = require("@/hooks/use-theme");
function ThemedText({ style, type = 'default', themeColor, ...rest }) {
    const theme = (0, use_theme_1.useTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
            { color: theme[themeColor ?? 'text'] },
            type === 'default' && styles.default,
            type === 'title' && styles.title,
            type === 'small' && styles.small,
            type === 'smallBold' && styles.smallBold,
            type === 'subtitle' && styles.subtitle,
            type === 'link' && styles.link,
            type === 'linkPrimary' && styles.linkPrimary,
            type === 'code' && styles.code,
            style,
        ], ...rest }));
}
const styles = react_native_1.StyleSheet.create({
    small: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: 500,
    },
    smallBold: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: 700,
    },
    default: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: 500,
    },
    title: {
        fontSize: 48,
        fontWeight: 600,
        lineHeight: 52,
    },
    subtitle: {
        fontSize: 32,
        lineHeight: 44,
        fontWeight: 600,
    },
    link: {
        lineHeight: 30,
        fontSize: 14,
    },
    linkPrimary: {
        lineHeight: 30,
        fontSize: 14,
        color: '#3c87f7',
    },
    code: {
        fontFamily: theme_1.Fonts.mono,
        fontWeight: react_native_1.Platform.select({ android: 700 }) ?? 500,
        fontSize: 12,
    },
});
