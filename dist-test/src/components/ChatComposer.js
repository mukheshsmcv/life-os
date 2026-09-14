"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatComposer = ChatComposer;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 120;
function ChatComposer({ value, onChangeText, onSend, disabled, placeholder, onVoicePress, voiceState = 'idle', voiceError, }) {
    const [inputHeight, setInputHeight] = (0, react_1.useState)(MIN_HEIGHT);
    const canSend = value.trim().length > 0 && !disabled;
    const voiceDisabled = disabled || voiceState === 'transcribing';
    const handleContentSizeChange = (e) => {
        const h = Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_HEIGHT), MAX_HEIGHT);
        setInputHeight(h);
    };
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.row, children: [(0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: value, onChangeText: onChangeText, placeholder: placeholder ?? 'Tell Life OS what you want…', placeholderTextColor: "#4A5060", style: [styles.input, { height: inputHeight }], multiline: true, onContentSizeChange: handleContentSizeChange, returnKeyType: "default", blurOnSubmit: false, accessibilityLabel: "Chat input", editable: !disabled }), onVoicePress && ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: [
                            styles.voiceButton,
                            voiceState === 'recording' && styles.voiceButtonRecording,
                            voiceDisabled && styles.voiceButtonDisabled,
                        ], onPress: voiceDisabled ? undefined : onVoicePress, accessibilityRole: "button", accessibilityLabel: voiceState === 'recording' ? 'Stop recording' : 'Record voice command', accessibilityState: { disabled: voiceDisabled }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.voiceText, children: voiceState === 'transcribing' ? '...' : voiceState === 'recording' ? 'Stop' : 'Mic' }) })), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: [styles.sendButton, !canSend && styles.sendButtonDisabled], onPress: canSend ? onSend : undefined, accessibilityRole: "button", accessibilityLabel: "Send message", accessibilityState: { disabled: !canSend }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.sendIcon, !canSend && styles.sendIconDisabled], children: "\u2191" }) })] }), voiceError && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.voiceError, children: voiceError })] }));
}
const styles = react_native_1.StyleSheet.create({
    container: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#0B0D10',
        borderTopWidth: 1,
        borderTopColor: '#191C22',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#171A20',
        borderRadius: 22,
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 21,
        paddingHorizontal: 18,
        paddingTop: 11,
        paddingBottom: 11,
        borderWidth: 1,
        borderColor: '#252932',
        textAlignVertical: 'center',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#A7A0FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#252932',
    },
    sendIcon: {
        color: '#0B0D10',
        fontSize: 18,
        fontWeight: '700',
    },
    sendIconDisabled: {
        color: '#4A5060',
    },
    voiceButton: {
        height: 42,
        borderRadius: 21,
        paddingHorizontal: 12,
        backgroundColor: '#252932',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceButtonRecording: {
        backgroundColor: '#FF7B7B',
    },
    voiceButtonDisabled: {
        opacity: 0.55,
    },
    voiceText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    voiceError: {
        color: '#FF9A9A',
        fontSize: 12,
        paddingTop: 8,
    },
});
