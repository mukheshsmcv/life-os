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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimatedSplashOverlay = AnimatedSplashOverlay;
exports.AnimatedIcon = AnimatedIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_image_1 = require("expo-image");
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const animated_icon_module_css_1 = __importDefault(require("./animated-icon.module.css"));
const DURATION = 300;
function AnimatedSplashOverlay() {
    return null;
}
const keyframe = new react_native_reanimated_1.Keyframe({
    0: {
        transform: [{ scale: 0 }],
    },
    60: {
        transform: [{ scale: 1.2 }],
        easing: react_native_reanimated_1.Easing.elastic(1.2),
    },
    100: {
        transform: [{ scale: 1 }],
        easing: react_native_reanimated_1.Easing.elastic(1.2),
    },
});
const logoKeyframe = new react_native_reanimated_1.Keyframe({
    0: {
        opacity: 0,
    },
    60: {
        transform: [{ scale: 1.2 }],
        opacity: 0,
        easing: react_native_reanimated_1.Easing.elastic(1.2),
    },
    100: {
        transform: [{ scale: 1 }],
        opacity: 1,
        easing: react_native_reanimated_1.Easing.elastic(1.2),
    },
});
const glowKeyframe = new react_native_reanimated_1.Keyframe({
    0: {
        transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
        opacity: 0,
    },
    [DURATION / 1000]: {
        transform: [{ rotateZ: '0deg' }, { scale: 1 }],
        opacity: 1,
        easing: react_native_reanimated_1.Easing.elastic(0.7),
    },
    100: {
        transform: [{ rotateZ: '7200deg' }],
    },
});
function AnimatedIcon() {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.iconContainer, children: [(0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { entering: glowKeyframe.duration(60 * 1000 * 4), style: styles.glow, children: (0, jsx_runtime_1.jsx)(expo_image_1.Image, { style: styles.glow, source: require('@/assets/images/logo-glow.png') }) }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: styles.background, entering: keyframe.duration(DURATION), children: (0, jsx_runtime_1.jsx)("div", { className: animated_icon_module_css_1.default.expoLogoBackground }) }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: styles.imageContainer, entering: logoKeyframe.duration(DURATION), children: (0, jsx_runtime_1.jsx)(expo_image_1.Image, { style: styles.image, source: require('@/assets/images/expo-logo.png') }) })] }));
}
const styles = react_native_1.StyleSheet.create({
    container: {
        alignItems: 'center',
        width: '100%',
        zIndex: 1000,
        position: 'absolute',
        top: 128 / 2 + 138,
    },
    imageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    glow: {
        width: 201,
        height: 201,
        position: 'absolute',
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 128,
        height: 128,
    },
    image: {
        position: 'absolute',
        width: 76,
        height: 71,
    },
    background: {
        width: 128,
        height: 128,
        position: 'absolute',
    },
});
