"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TabTwoScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const expo_image_1 = require("expo-image");
const expo_symbols_1 = require("expo-symbols");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const external_link_1 = require("@/components/external-link");
const themed_text_1 = require("@/components/themed-text");
const themed_view_1 = require("@/components/themed-view");
const collapsible_1 = require("@/components/ui/collapsible");
const web_badge_1 = require("@/components/web-badge");
const theme_1 = require("@/constants/theme");
const use_theme_1 = require("@/hooks/use-theme");
function TabTwoScreen() {
    const safeAreaInsets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    const insets = {
        ...safeAreaInsets,
        bottom: safeAreaInsets.bottom + theme_1.BottomTabInset + theme_1.Spacing.three,
    };
    const theme = (0, use_theme_1.useTheme)();
    const contentPlatformStyle = react_native_1.Platform.select({
        android: {
            paddingTop: insets.top,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
        },
        web: {
            paddingTop: theme_1.Spacing.six,
            paddingBottom: theme_1.Spacing.four,
        },
    });
    return ((0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { style: [styles.scrollView, { backgroundColor: theme.background }], contentInset: insets, contentContainerStyle: [styles.contentContainer, contentPlatformStyle], children: (0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { style: styles.titleContainer, children: [(0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "subtitle", children: "Explore" }), (0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { style: styles.centerText, themeColor: "textSecondary", children: ["This starter app includes example", '\n', "code to help you get started."] }), (0, jsx_runtime_1.jsx)(external_link_1.ExternalLink, { href: "https://docs.expo.dev", asChild: true, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: ({ pressed }) => pressed && styles.pressed, children: (0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { type: "backgroundElement", style: styles.linkButton, children: [(0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "link", children: "Expo documentation" }), (0, jsx_runtime_1.jsx)(expo_symbols_1.SymbolView, { tintColor: theme.text, name: { ios: 'arrow.up.right.square', android: 'link', web: 'link' }, size: 12 })] }) }) })] }), (0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { style: styles.sectionsWrapper, children: [(0, jsx_runtime_1.jsxs)(collapsible_1.Collapsible, { title: "File-based routing", children: [(0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["This app has two screens: ", (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "src/app/index.tsx" }), " and", ' ', (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "src/app/explore.tsx" })] }), (0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["The layout file in ", (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "src/app/_layout.tsx" }), " sets up the tab navigator."] }), (0, jsx_runtime_1.jsx)(external_link_1.ExternalLink, { href: "https://docs.expo.dev/router/introduction", children: (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), (0, jsx_runtime_1.jsx)(collapsible_1.Collapsible, { title: "Android, iOS, and web support", children: (0, jsx_runtime_1.jsxs)(themed_view_1.ThemedView, { type: "backgroundElement", style: styles.collapsibleContent, children: [(0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["You can open this project on Android, iOS, and the web. To open the web version, press ", (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "smallBold", children: "w" }), " in the terminal running this project."] }), (0, jsx_runtime_1.jsx)(expo_image_1.Image, { source: require('@/assets/images/tutorial-web.png'), style: styles.imageTutorial })] }) }), (0, jsx_runtime_1.jsxs)(collapsible_1.Collapsible, { title: "Images", children: [(0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["For static images, you can use the ", (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "@2x" }), " and", ' ', (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "@3x" }), " suffixes to provide files for different screen densities."] }), (0, jsx_runtime_1.jsx)(expo_image_1.Image, { source: require('@/assets/images/react-logo.png'), style: styles.imageReact }), (0, jsx_runtime_1.jsx)(external_link_1.ExternalLink, { href: "https://reactnative.dev/docs/images", children: (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), (0, jsx_runtime_1.jsxs)(collapsible_1.Collapsible, { title: "Light and dark mode components", children: [(0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["This template has light and dark mode support. The", ' ', (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "useColorScheme()" }), " hook lets you inspect what the user's current color scheme is, and so you can adjust UI colors accordingly."] }), (0, jsx_runtime_1.jsx)(external_link_1.ExternalLink, { href: "https://docs.expo.dev/develop/user-interface/color-themes/", children: (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "linkPrimary", children: "Learn more" }) })] }), (0, jsx_runtime_1.jsx)(collapsible_1.Collapsible, { title: "Animations", children: (0, jsx_runtime_1.jsxs)(themed_text_1.ThemedText, { type: "small", children: ["This template includes an example of an animated component. The", ' ', (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "src/components/ui/collapsible.tsx" }), " component uses the powerful ", (0, jsx_runtime_1.jsx)(themed_text_1.ThemedText, { type: "code", children: "react-native-reanimated" }), " library to animate opening this hint."] }) })] }), react_native_1.Platform.OS === 'web' && (0, jsx_runtime_1.jsx)(web_badge_1.WebBadge, {})] }) }));
}
const styles = react_native_1.StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    container: {
        maxWidth: theme_1.MaxContentWidth,
        flexGrow: 1,
    },
    titleContainer: {
        gap: theme_1.Spacing.three,
        alignItems: 'center',
        paddingHorizontal: theme_1.Spacing.four,
        paddingVertical: theme_1.Spacing.six,
    },
    centerText: {
        textAlign: 'center',
    },
    pressed: {
        opacity: 0.7,
    },
    linkButton: {
        flexDirection: 'row',
        paddingHorizontal: theme_1.Spacing.four,
        paddingVertical: theme_1.Spacing.two,
        borderRadius: theme_1.Spacing.five,
        justifyContent: 'center',
        gap: theme_1.Spacing.one,
        alignItems: 'center',
    },
    sectionsWrapper: {
        gap: theme_1.Spacing.five,
        paddingHorizontal: theme_1.Spacing.four,
        paddingTop: theme_1.Spacing.three,
    },
    collapsibleContent: {
        alignItems: 'center',
    },
    imageTutorial: {
        width: '100%',
        aspectRatio: 296 / 171,
        borderRadius: theme_1.Spacing.three,
        marginTop: theme_1.Spacing.two,
    },
    imageReact: {
        width: 100,
        height: 100,
        alignSelf: 'center',
    },
});
