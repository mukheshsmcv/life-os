"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ChatScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const expo_router_1 = require("expo-router");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_audio_1 = require("expo-audio");
const action_validator_1 = require("@/ai/action-validator");
const action_executor_1 = require("@/ai/action-executor");
const ai_client_1 = require("@/ai/ai-client");
const voice_client_1 = require("@/ai/voice-client");
const tasks_context_1 = require("@/contexts/tasks-context");
const date_time_1 = require("@/lib/date-time");
const ChatMessage_1 = require("@/components/ChatMessage");
const ChatComposer_1 = require("@/components/ChatComposer");
const SuggestionChip_1 = require("@/components/SuggestionChip");
const ThinkingIndicator_1 = require("@/components/ThinkingIndicator");
const EmptyState_1 = require("@/components/EmptyState");
// ─── Helpers ─────────────────────────────────────────────────────────────────
const SUGGESTION_CHIPS = [
    "What's next?",
    'Plan my day',
    'Free time',
    'Replan evening',
];
/**
 * Map an AIAction to a MessageAction card descriptor.
 * Returns null for informational actions that don't need a card.
 */
function actionToCard(action) {
    switch (action.type) {
        case 'create_task':
            return {
                cardType: 'task_created',
                title: action.payload.title,
                durationMinutes: action.payload.durationMinutes,
                date: action.payload.date ?? null,
                priority: action.payload.priority,
            };
        case 'complete_task':
            return { cardType: 'task_completed' };
        case 'skip_task':
            return { cardType: 'task_skipped' };
        case 'delete_task':
            return { cardType: 'task_deleted' };
        case 'update_task':
            return { cardType: 'task_updated' };
        case 'replan_day':
            return { cardType: 'day_replanned' };
        case 'clarification':
            return null;
        default:
            return null;
    }
}
// ─── Screen ──────────────────────────────────────────────────────────────────
function ChatScreen() {
    const router = (0, expo_router_1.useRouter)();
    const insets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    const { tasks, events, addTask, updateTask, addEvent, updateEvent, completeTask, skipTask, deleteTask, deleteEvent } = (0, tasks_context_1.useTasks)();
    const [input, setInput] = (0, react_1.useState)('');
    const [isThinking, setIsThinking] = (0, react_1.useState)(false);
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [pendingClarification, setPendingClarification] = (0, react_1.useState)(null);
    const [activeActivityId, setActiveActivityId] = (0, react_1.useState)(null);
    const flatListRef = (0, react_1.useRef)(null);
    const isNearBottomRef = (0, react_1.useRef)(true);
    const audioRecorder = (0, expo_audio_1.useAudioRecorder)(expo_audio_1.RecordingPresets.HIGH_QUALITY);
    const recorderState = (0, expo_audio_1.useAudioRecorderState)(audioRecorder);
    const [microphoneGranted, setMicrophoneGranted] = (0, react_1.useState)(null);
    const [isTranscribing, setIsTranscribing] = (0, react_1.useState)(false);
    const [voiceError, setVoiceError] = (0, react_1.useState)(null);
    const handleScroll = (event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 60;
        const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
        isNearBottomRef.current = isCloseToBottom;
    };
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const initializeAudio = async () => {
            try {
                const permission = await expo_audio_1.AudioModule.requestRecordingPermissionsAsync();
                if (cancelled)
                    return;
                setMicrophoneGranted(permission.granted);
                if (permission.granted) {
                    await (0, expo_audio_1.setAudioModeAsync)({
                        playsInSilentMode: true,
                        allowsRecording: true,
                    });
                }
            }
            catch (error) {
                if (!cancelled) {
                    setVoiceError(error instanceof Error ? error.message : 'Unable to initialize microphone.');
                }
            }
        };
        void initializeAudio();
        return () => {
            cancelled = true;
        };
    }, []);
    const handleContentSizeChange = () => {
        if (isNearBottomRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
        }
    };
    // Auto-scroll when messages change or thinking state changes (only if user is at bottom)
    (0, react_1.useEffect)(() => {
        if (isNearBottomRef.current) {
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [messages, isThinking]);
    // ─── Send message ───────────────────────────────────────────────────────────
    const handleSend = async (overrideText) => {
        const userText = (overrideText ?? input).trim();
        if (!userText || isThinking)
            return;
        setInput('');
        react_native_1.Keyboard.dismiss();
        isNearBottomRef.current = true;
        const userMessage = {
            id: `msg-user-${Date.now()}`,
            sender: 'user',
            text: userText,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsThinking(true);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        try {
            const parseResult = await (0, ai_client_1.parseIntentWithAI)(userText, {
                tasks,
                currentDate: (0, date_time_1.getTodayString)(),
                currentTime: (0, date_time_1.getCurrentTimeStringIST)(),
                timezone: 'Asia/Kolkata',
                pendingClarification,
                activeActivityId,
            });
            if (parseResult.pendingClarification !== undefined) {
                setPendingClarification(parseResult.pendingClarification);
            }
            if (!parseResult.success) {
                const assistantMessage = {
                    id: `msg-ast-${Date.now()}`,
                    sender: 'assistant',
                    text: parseResult.error,
                    timestamp: new Date(),
                    notice: parseResult.notice,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setIsThinking(false);
                return;
            }
            // Execute each action and collect results (deduplicate equivalent creations first)
            const replyLines = [];
            const cards = [];
            const actionsToExecute = (0, action_executor_1.deduplicateActions)(parseResult.actions);
            for (const action of actionsToExecute) {
                const validation = (0, action_validator_1.validateAction)(action, tasks);
                if (!validation.valid) {
                    replyLines.push(validation.error);
                    continue;
                }
                const execution = (0, action_executor_1.executeAction)(validation.action, {
                    tasks,
                    events,
                    operations: { addTask, updateTask, addEvent: addEvent, updateEvent: updateEvent, completeTask, skipTask, deleteTask, deleteEvent },
                    currentTime: new Date(),
                });
                if (execution.success) {
                    setPendingClarification(null);
                    if (execution.createdId) {
                        setActiveActivityId(execution.createdId);
                    }
                    else if (validation.resolvedTaskId) {
                        setActiveActivityId(validation.resolvedTaskId);
                    }
                }
                replyLines.push(execution.message || '');
                // Build inline action card from original action (before validation rewrites)
                const card = actionToCard(action);
                if (card) {
                    // Enrich with resolved title for ref-based actions
                    if (!card.title &&
                        (action.type === 'complete_task' ||
                            action.type === 'skip_task' ||
                            action.type === 'delete_task' ||
                            action.type === 'update_task')) {
                        const taskId = validation.resolvedTaskId;
                        const found = tasks.find((t) => t.id === taskId);
                        if (found)
                            card.title = found.title;
                    }
                    cards.push(card);
                }
            }
            const assistantMessage = {
                id: `msg-ast-${Date.now()}`,
                sender: 'assistant',
                text: replyLines.join('\n\n'),
                timestamp: new Date(),
                notice: parseResult.notice,
                actions: cards.length > 0 ? cards : undefined,
            };
            setMessages((prev) => [...prev, assistantMessage]);
        }
        catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `msg-err-${Date.now()}`,
                    sender: 'assistant',
                    text: "I'm having trouble connecting right now. Please try again.",
                    timestamp: new Date(),
                },
            ]);
        }
        finally {
            setIsThinking(false);
        }
    };
    const handleVoicePress = async () => {
        if (isTranscribing)
            return;
        setVoiceError(null);
        if (recorderState.isRecording) {
            try {
                await audioRecorder.stop();
                const recordingUri = audioRecorder.uri;
                if (!recordingUri) {
                    throw new Error('No audio recording was produced.');
                }
                setIsTranscribing(true);
                const transcript = await (0, voice_client_1.transcribeAudio)(recordingUri);
                setIsTranscribing(false);
                await handleSend(transcript);
            }
            catch (error) {
                setIsTranscribing(false);
                setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed.');
            }
            return;
        }
        if (microphoneGranted !== true) {
            setVoiceError('Microphone permission is required for voice commands.');
            return;
        }
        try {
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
        }
        catch (error) {
            setVoiceError(error instanceof Error ? error.message : 'Unable to start recording.');
        }
    };
    const handleSuggestionChip = (label) => {
        const chipTexts = {
            "What's next?": "What's next on my schedule?",
            'Plan my day': 'Plan my day',
            'Free time': 'How much free time do I have today?',
            'Replan evening': 'Replan my evening',
        };
        const text = chipTexts[label] ?? label;
        handleSend(text);
    };
    const isEmpty = messages.length === 0;
    // Bottom padding: native tab bar on Android is approximately 80px
    const tabBarHeight = react_native_1.Platform.OS === 'android' ? 80 : 50;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.container, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.header, { paddingTop: Math.max(insets.top, 12) }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.headerLeft, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.statusDot }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.statusText, children: isThinking ? 'Planning' : 'Ready' })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.headerTitle, children: "Life OS" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { style: styles.headerRight, onPress: () => router.push('/calendar'), accessibilityLabel: "Open Calendar", accessibilityRole: "button", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.calendarIcon, children: "\u229E" }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.KeyboardAvoidingView, { style: styles.flex, behavior: react_native_1.Platform.OS === 'ios' ? 'padding' : 'padding', keyboardVerticalOffset: react_native_1.Platform.OS === 'ios' ? tabBarHeight : tabBarHeight, children: [isEmpty ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.flex, children: (0, jsx_runtime_1.jsx)(EmptyState_1.EmptyState, { onSelectPrompt: (text) => handleSend(text) }) })) : ((0, jsx_runtime_1.jsx)(react_native_1.FlatList, { ref: flatListRef, data: messages, keyExtractor: (item) => item.id, renderItem: ({ item }) => (0, jsx_runtime_1.jsx)(ChatMessage_1.ChatMessage, { message: item }), ListFooterComponent: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [isThinking && (0, jsx_runtime_1.jsx)(ThinkingIndicator_1.ThinkingIndicator, {}), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.bottomSpacer })] }), style: styles.flex, contentContainerStyle: styles.messagesContent, keyboardShouldPersistTaps: "handled", showsVerticalScrollIndicator: true, onScroll: handleScroll, scrollEventThrottle: 16, onContentSizeChange: handleContentSizeChange })), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: styles.chipsScroll, contentContainerStyle: styles.chipsContent, keyboardShouldPersistTaps: "always", children: SUGGESTION_CHIPS.map((chip) => ((0, jsx_runtime_1.jsx)(SuggestionChip_1.SuggestionChip, { label: chip, onPress: () => handleSuggestionChip(chip) }, chip))) }), (0, jsx_runtime_1.jsx)(ChatComposer_1.ChatComposer, { value: input, onChangeText: setInput, onSend: () => handleSend(), disabled: isThinking, onVoicePress: () => void handleVoicePress(), voiceState: isTranscribing ? 'transcribing' : recorderState.isRecording ? 'recording' : 'idle', voiceError: voiceError })] })] }));
}
// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0D10',
    },
    flex: { flex: 1 },
    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#191C22',
        backgroundColor: '#0B0D10',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 70,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#5ECC8B',
    },
    statusText: {
        color: '#5ECC8B',
        fontSize: 12,
        fontWeight: '600',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerRight: {
        minWidth: 70,
        alignItems: 'flex-end',
    },
    calendarIcon: {
        color: '#737983',
        fontSize: 20,
    },
    // ── Messages ──
    messagesContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        gap: 12,
    },
    bottomSpacer: { height: 8 },
    // ── Suggestion chips ──
    chipsScroll: {
        flexGrow: 0,
        borderTopWidth: 1,
        borderTopColor: '#191C22',
        backgroundColor: '#0B0D10',
    },
    chipsContent: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
    },
});
