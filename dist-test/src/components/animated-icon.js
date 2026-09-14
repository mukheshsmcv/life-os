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
exports.AnimatedSplashOverlay = AnimatedSplashOverlay;
exports.AnimatedIcon = AnimatedIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_image_1 = require("expo-image");
const SplashScreen = __importStar(require("expo-splash-screen"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const react_native_worklets_1 = require("react-native-worklets");
const INITIAL_SCALE_FACTOR = react_native_1.Dimensions.get('screen').height / 90;
const DURATION = 600;
function AnimatedSplashOverlay() {
    const [animate, setAnimate] = (0, react_1.useState)(false);
    const [visible, setVisible] = (0, react_1.useState)(true);
    if (!visible)
        return null;
    const splashKeyframe = new react_native_reanimated_1.Keyframe({
        0: {
            transform: [{ scale: 1 }],
            opacity: 1,
        },
        20: {
            opacity: 1,
        },
        70: {
            opacity: 0,
            easing: react_native_reanimated_1.Easing.elastic(0.7),
        },
        100: {
            opacity: 0,
            transform: [{ scale: 1 }],
            easing: react_native_reanimated_1.Easing.elastic(0.7),
        },
    });
    const image = (0, jsx_runtime_1.jsx)(expo_image_1.Image, { style: styles.image, source: require('@/assets/images/expo-logo.png') });
    return animate ? ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { entering: splashKeyframe.duration(DURATION).withCallback((finished) => {
            'worklet';
            if (finished) {
                (0, react_native_worklets_1.scheduleOnRN)(setVisible, false);
            }
        }), style: styles.splashOverlay, children: image })) : ((0, jsx_runtime_1.jsx)(react_native_1.View, { onLayout: () => {
            SplashScreen.hideAsync().finally(() => {
                setAnimate(true);
            });
        }, style: styles.splashOverlay, children: image }));
}
const keyframe = new react_native_reanimated_1.Keyframe({
    0: {
        transform: [{ scale: INITIAL_SCALE_FACTOR }],
    },
    100: {
        transform: [{ scale: 1 }],
        easing: react_native_reanimated_1.Easing.elastic(0.7),
    },
});
const logoKeyframe = new react_native_reanimated_1.Keyframe({
    0: {
        transform: [{ scale: 1.3 }],
        opacity: 0,
    },
    40: {
        transform: [{ scale: 1.3 }],
        opacity: 0,
        easing: react_native_reanimated_1.Easing.elastic(0.7),
    },
    100: {
        opacity: 1,
        transform: [{ scale: 1 }],
        easing: react_native_reanimated_1.Easing.elastic(0.7),
    },
});
const glowKeyframe = new react_native_reanimated_1.Keyframe({
    0: {
        transform: [{ rotateZ: '0deg' }],
    },
    100: {
        transform: [{ rotateZ: '7200deg' }],
    },
});
function AnimatedIcon() {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.iconContainer, children: [(0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { entering: glowKeyframe.duration(60 * 1000 * 4), style: styles.glow, children: (0, jsx_runtime_1.jsx)(expo_image_1.Image, { style: styles.glow, source: require('@/assets/images/logo-glow.png') }) }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { entering: keyframe.duration(DURATION), style: styles.background }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: styles.imageContainer, entering: logoKeyframe.duration(DURATION), children: (0, jsx_runtime_1.jsx)(expo_image_1.Image, { style: styles.image, source: require('@/assets/images/expo-logo.png') }) })] }));
}
const styles = react_native_1.StyleSheet.create({
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
        zIndex: 100,
    },
    image: {
        width: 76,
        height: 71,
    },
    background: {
        borderRadius: 40,
        experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
        width: 128,
        height: 128,
        position: 'absolute',
    },
    splashOverlay: {
        ...react_native_1.StyleSheet.absoluteFill,
        backgroundColor: '#208AEF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
});
