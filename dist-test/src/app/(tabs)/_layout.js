"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TabsLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const expo_router_1 = require("expo-router");
const app_tabs_1 = __importDefault(require("@/components/app-tabs"));
const add_action_modal_1 = require("@/components/add-action-modal");
function TabsLayout() {
    const [modalVisible, setModalVisible] = (0, react_1.useState)(false);
    const pathname = (0, expo_router_1.usePathname)();
    const isChat = pathname ? pathname === '/chat' || pathname.startsWith('/chat') : false;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.container, children: [(0, jsx_runtime_1.jsx)(app_tabs_1.default, {}), !isChat && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => setModalVisible(true), style: styles.fab, accessibilityLabel: "Add Task or Event", accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.fabIcon, children: "+" }) })), (0, jsx_runtime_1.jsx)(add_action_modal_1.AddActionModal, { visible: modalVisible, onClose: () => setModalVisible(false) })] }));
}
const styles = react_native_1.StyleSheet.create({
    container: { flex: 1 },
    fab: {
        position: 'absolute',
        bottom: 84,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#A7A0FF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 9999,
    },
    fabIcon: {
        color: '#0B0D10',
        fontSize: 32,
        fontWeight: '400',
        marginTop: -2,
    },
});
