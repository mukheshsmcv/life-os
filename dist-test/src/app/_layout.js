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
exports.default = RootLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_router_1 = require("expo-router");
const expo_router_2 = require("expo-router");
const SplashScreen = __importStar(require("expo-splash-screen"));
const react_native_1 = require("react-native");
const react_native_gesture_handler_1 = require("react-native-gesture-handler");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const animated_icon_1 = require("@/components/animated-icon");
const tasks_context_1 = require("@/contexts/tasks-context");
SplashScreen.preventAutoHideAsync();
function RootLayout() {
    const colorScheme = (0, react_native_1.useColorScheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_gesture_handler_1.GestureHandlerRootView, { style: styles.gestureRoot, children: (0, jsx_runtime_1.jsx)(react_native_safe_area_context_1.SafeAreaProvider, { children: (0, jsx_runtime_1.jsxs)(expo_router_2.ThemeProvider, { value: colorScheme === 'dark' ? expo_router_2.DarkTheme : expo_router_2.DefaultTheme, children: [(0, jsx_runtime_1.jsx)(animated_icon_1.AnimatedSplashOverlay, {}), (0, jsx_runtime_1.jsx)(tasks_context_1.TasksProvider, { children: (0, jsx_runtime_1.jsxs)(expo_router_1.Stack, { screenOptions: { headerShown: false }, children: [(0, jsx_runtime_1.jsx)(expo_router_1.Stack.Screen, { name: "(tabs)", options: { headerShown: false } }), (0, jsx_runtime_1.jsx)(expo_router_1.Stack.Screen, { name: "calendar", options: { headerShown: false } })] }) })] }) }) }));
}
const styles = react_native_1.StyleSheet.create({
    gestureRoot: { flex: 1 },
});
