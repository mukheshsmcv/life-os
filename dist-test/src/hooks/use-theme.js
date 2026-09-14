"use strict";
/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTheme = useTheme;
const theme_1 = require("@/constants/theme");
const use_color_scheme_1 = require("@/hooks/use-color-scheme");
function useTheme() {
    const scheme = (0, use_color_scheme_1.useColorScheme)();
    const theme = scheme === 'unspecified' ? 'light' : scheme;
    return theme_1.Colors[theme];
}
