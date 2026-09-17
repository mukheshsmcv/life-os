import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, FlatList, ScrollView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import { validateAction } from '@/ai/action-validator';
import { deduplicateActions, executeAction } from '@/ai/action-executor';
import { parseIntentWithAI } from '@/ai/ai-client';
import { AIAction } from '@/ai/ai-types';
import { transcribeAudio } from '@/ai/voice-client';
import { useTasks } from '@/contexts/tasks-context';
import { getTodayString, getCurrentTimeStringIST } from '@/lib/date-time';

import { ChatMessage, ChatMessageData, MessageAction } from '@/components/ChatMessage';
import { ChatComposer } from '@/components/ChatComposer';
import { SuggestionChip } from '@/components/SuggestionChip';
import { ThinkingIndicator } from '@/components/ThinkingIndicator';
import { EmptyState } from '@/components/EmptyState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  "What's next?",
  'Plan my day',
  'Free time',
  'Replan evening',
];

type SpeechRecognitionModule =
  typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

function mergeTranscript(previous: string, next: string): string {
  const normalizedNext = next.trim();
  if (!previous) return normalizedNext;
  if (normalizedNext === previous || normalizedNext.startsWith(`${previous} `)) {
    return normalizedNext;
  }
  return `${previous} ${normalizedNext}`;
}

/**
 * Map an AIAction to a MessageAction card descriptor.
 * Returns null for informational actions that don't need a card.
 */
function actionToCard(action: AIAction): MessageAction | null {
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

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ taskId?: string }>();
  const { tasks, events, addTask, updateTask, addEvent, updateEvent, completeTask, skipTask, deleteTask, deleteEvent } = useTasks();

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pendingClarification, setPendingClarification] = useState<import('@/ai/ai-types').PendingClarification | null>(null);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(params.taskId || null);

  const flatListRef = useRef<FlatList<ChatMessageData>>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [microphoneGranted, setMicrophoneGranted] = useState<boolean | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeechRecognizing, setIsSpeechRecognizing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string | undefined>(undefined);
  const [voiceReviewing, setVoiceReviewing] = useState(false);

  const speechModuleRef = useRef<SpeechRecognitionModule | null>(null);
  const speechModuleLoadRef = useRef<Promise<SpeechRecognitionModule | null> | null>(null);
  const speechListenersAttachedRef = useRef(false);
  const speechSubscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const finalTranscriptRef = useRef('');
  const liveTranscriptRef = useRef('');
  const speechAudioUriRef = useRef<string | null>(null);
  const webAudioRecordingRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 60;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isNearBottomRef.current = isCloseToBottom;
  };

  useEffect(() => {
    let cancelled = false;

    const initializeAudio = async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (cancelled) return;

        setMicrophoneGranted(permission.granted);
        if (permission.granted) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });
        }
      } catch (error) {
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
  useEffect(() => {
    if (isNearBottomRef.current) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [messages, isThinking]);

  // ─── Send message ───────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if (!userText || isThinking) return;

    setInput('');
    setVoiceReviewing(false);
    Keyboard.dismiss();
    isNearBottomRef.current = true;

    const userMessage: ChatMessageData = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const snapshot = import('@/lib/current-state').then(m => m.getCurrentStateSnapshot(tasks, events || [], new Date()));
      
      const parseResult = await parseIntentWithAI(userText, {
        tasks,
        currentDate: getTodayString(),
        currentTime: getCurrentTimeStringIST(),
        timezone: 'Asia/Kolkata',
        pendingClarification,
        activeActivityId,
        currentStateSnapshot: await snapshot,
      });

      if (parseResult.pendingClarification !== undefined) {
        setPendingClarification(parseResult.pendingClarification);
      }

      if (!parseResult.success) {
        const assistantMessage: ChatMessageData = {
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
      const replyLines: string[] = [];
      const cards: MessageAction[] = [];
      const actionsToExecute = deduplicateActions(parseResult.actions);

      for (const action of actionsToExecute) {
        const validation = validateAction(action, tasks);

        if (!validation.valid) {
          replyLines.push(validation.error);
          continue;
        }

        const execution = executeAction(validation.action, {
          tasks,
          events,
          operations: { addTask, updateTask, addEvent: addEvent as any, updateEvent: updateEvent as any, completeTask, skipTask, deleteTask, deleteEvent },
          currentTime: new Date(),
        });

        if (execution.success) {
          setPendingClarification(null);
          
          if (execution.createdId) {
            setActiveActivityId(execution.createdId);
          } else if (validation.resolvedTaskId) {
            setActiveActivityId(validation.resolvedTaskId);
          }
        }

        replyLines.push(execution.message || '');

        // Build inline action card from original action (before validation rewrites)
        const card = actionToCard(action);
        if (card) {
          // Enrich with resolved title for ref-based actions
          if (
            !card.title &&
            (action.type === 'complete_task' ||
              action.type === 'skip_task' ||
              action.type === 'delete_task' ||
              action.type === 'update_task')
          ) {
            const taskId = validation.resolvedTaskId;
            const found = tasks.find((t) => t.id === taskId);
            if (found) card.title = found.title;
          }
          cards.push(card);
        }
      }

      const assistantMessage: ChatMessageData = {
        id: `msg-ast-${Date.now()}`,
        sender: 'assistant',
        text: replyLines.join('\n\n'),
        timestamp: new Date(),
        notice: parseResult.notice,
        actions: cards.length > 0 ? cards : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: "I'm having trouble connecting right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const finalizeVoiceReview = async (fallbackTranscript: string, recordingUri: string | null) => {
    let transcript = fallbackTranscript;

    if (recordingUri) {
      setIsTranscribing(true);
      try {
        transcript = await transcribeAudio(recordingUri);
      } catch (error) {
        setVoiceError(
          error instanceof Error
            ? `Final transcription failed. Review the live transcript before sending. ${error.message}`
            : 'Final transcription failed. Review the live transcript before sending.'
        );
      } finally {
        setIsTranscribing(false);
      }
    }

    if (!transcript.trim()) {
      setVoiceError('No speech was detected.');
      return;
    }

    setInput(transcript.trim());
    setVoiceReviewing(true);
  };

  const attachSpeechListeners = (module: SpeechRecognitionModule) => {
    if (speechListenersAttachedRef.current) return;

    speechSubscriptionsRef.current = [
      module.addListener('start', () => {
        setIsSpeechRecognizing(true);
        setIsTranscribing(false);
      }),
      module.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
        const transcript = event.results[0]?.transcript?.trim() ?? '';
        if (!transcript) return;

        if (event.isFinal) {
          finalTranscriptRef.current = mergeTranscript(finalTranscriptRef.current, transcript);
          liveTranscriptRef.current = finalTranscriptRef.current;
        } else {
          liveTranscriptRef.current = mergeTranscript(finalTranscriptRef.current, transcript);
        }
        setLiveTranscript(liveTranscriptRef.current);
      }),
      module.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
        setIsSpeechRecognizing(false);
        setIsTranscribing(false);
        stopRequestedRef.current = false;
        finalTranscriptRef.current = '';
        liveTranscriptRef.current = '';
        speechAudioUriRef.current = null;
        setLiveTranscript(undefined);

        if (event.error !== 'aborted') {
          setVoiceError(event.message || 'Live speech recognition failed.');
        }
      }),
      module.addListener(
        'audioend',
        (event: ExpoSpeechRecognitionNativeEventMap['audioend']) => {
          if (event.uri) {
            speechAudioUriRef.current = event.uri;
          }
        }
      ),
      module.addListener('end', () => {
        const shouldSubmit = stopRequestedRef.current;
        const transcript = (finalTranscriptRef.current || liveTranscriptRef.current).trim();
        const recordingUri = speechAudioUriRef.current;

        setIsSpeechRecognizing(false);
        setIsTranscribing(false);
        stopRequestedRef.current = false;
        finalTranscriptRef.current = '';
        liveTranscriptRef.current = '';
        speechAudioUriRef.current = null;
        setLiveTranscript(undefined);

        if (!shouldSubmit) return;
        void finalizeVoiceReview(transcript, recordingUri);
      }),
    ];
    speechListenersAttachedRef.current = true;
  };

  const loadSpeechRecognitionModule = async (): Promise<SpeechRecognitionModule | null> => {
    if (speechModuleRef.current) return speechModuleRef.current;
    if (speechModuleLoadRef.current) return speechModuleLoadRef.current;

    speechModuleLoadRef.current = import('expo-speech-recognition')
      .then(({ ExpoSpeechRecognitionModule }) => {
        speechModuleRef.current = ExpoSpeechRecognitionModule;
        attachSpeechListeners(ExpoSpeechRecognitionModule);
        return ExpoSpeechRecognitionModule;
      })
      .catch(() => null);

    return speechModuleLoadRef.current;
  };

  useEffect(() => {
    void loadSpeechRecognitionModule();

    return () => {
      speechSubscriptionsRef.current.forEach((subscription) => subscription.remove());
      speechSubscriptionsRef.current = [];
      speechListenersAttachedRef.current = false;
    };
  }, []);

  const handleVoicePress = async () => {
    if (isTranscribing) return;
    setVoiceError(null);

    if (isSpeechRecognizing) {
      const speechModule = speechModuleRef.current;
      if (!speechModule) return;

      setIsTranscribing(true);
      stopRequestedRef.current = true;
      if (Platform.OS === 'web' && webAudioRecordingRef.current) {
        try {
          await audioRecorder.stop();
          speechAudioUriRef.current = audioRecorder.uri;
        } catch (error) {
          setVoiceError(
            error instanceof Error ? error.message : 'Unable to save the browser recording.'
          );
        } finally {
          webAudioRecordingRef.current = false;
        }
      }
      speechModule.stop();
      return;
    }

    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
        const recordingUri = audioRecorder.uri;
        if (!recordingUri) {
          throw new Error('No audio recording was produced.');
        }

        setIsTranscribing(true);
        const transcript = await transcribeAudio(recordingUri);
        setIsTranscribing(false);
        setInput(transcript);
        setVoiceReviewing(true);
      } catch (error) {
        setIsTranscribing(false);
        setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed.');
      }
      return;
    }

    try {
      setVoiceReviewing(false);
      const speechModule = await loadSpeechRecognitionModule();
      if (speechModule) {
        const permission = await speechModule.requestPermissionsAsync();
        if (!permission.granted) {
          setVoiceError('Microphone and speech recognition permissions are required.');
          return;
        }

        finalTranscriptRef.current = '';
        liveTranscriptRef.current = '';
        speechAudioUriRef.current = null;
        setLiveTranscript('');
        stopRequestedRef.current = false;
        if (Platform.OS === 'web') {
          try {
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            webAudioRecordingRef.current = true;
          } catch (error) {
            setVoiceError(
              error instanceof Error
                ? `Live transcription is active, but final audio capture failed. ${error.message}`
                : 'Live transcription is active, but final audio capture failed.'
            );
          }
        }
        speechModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          maxAlternatives: 1,
          recordingOptions: { persist: true },
        });
        setIsSpeechRecognizing(true);
        return;
      }

      if (microphoneGranted !== true) {
        setVoiceError('Microphone permission is required for voice commands.');
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Unable to start recording.');
    }
  };

  const handleVoiceCancel = async () => {
    setVoiceError(null);
    setVoiceReviewing(false);
    stopRequestedRef.current = false;
    finalTranscriptRef.current = '';
    liveTranscriptRef.current = '';
    speechAudioUriRef.current = null;
    setLiveTranscript(undefined);

    if (isSpeechRecognizing) {
      if (Platform.OS === 'web' && webAudioRecordingRef.current) {
        try {
          await audioRecorder.stop();
        } catch (error) {
          setVoiceError(
            error instanceof Error ? error.message : 'Unable to discard the browser recording.'
          );
        } finally {
          webAudioRecordingRef.current = false;
        }
      }
      speechModuleRef.current?.abort();
      setIsSpeechRecognizing(false);
      setIsTranscribing(false);
      return;
    }

    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
      } catch (error) {
        setVoiceError(error instanceof Error ? error.message : 'Unable to cancel recording.');
      }
    }
  };

  const handleSuggestionChip = (label: string) => {
    const chipTexts: Record<string, string> = {
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
  const tabBarHeight = Platform.OS === 'android' ? 80 : 50;

  const hasNavigatedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const checkSwipeAndNavigate = (
    translationX: number,
    translationY: number,
    absoluteX?: number,
    absoluteY?: number
  ) => {
    const startX = startXRef.current;
    const startY = startYRef.current;
    const totalDx = absoluteX !== undefined && startX > 0 ? absoluteX - startX : translationX;
    const totalDy = absoluteY !== undefined && startY > 0 ? absoluteY - startY : translationY;

    const dx = Math.max(Math.abs(translationX), Math.abs(totalDx));
    const absDy = Math.max(Math.abs(translationY), Math.abs(totalDy));

    const isNegativeSwipe = translationX < 0 || (absoluteX !== undefined && startX > 0 && absoluteX - startX < 0);
    const isPositiveSwipe = translationX > 0 || (absoluteX !== undefined && startX > 0 && absoluteX - startX > 0);
    const hasMinDistance = dx >= 60;
    const isClearlyHorizontal = dx > absDy * 1.4;

    if (hasNavigatedRef.current) return;

    if (hasMinDistance && isClearlyHorizontal) {
      if (isPositiveSwipe) {
        hasNavigatedRef.current = true;
        router.navigate('/messenger');
      }
    }
  };

  const swipeToMessagesGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .runOnJS(true)
    .onBegin((event) => {
      hasNavigatedRef.current = false;
      startXRef.current = event.absoluteX;
      startYRef.current = event.absoluteY;
    })
    .onUpdate((event) => {
      checkSwipeAndNavigate(
        event.translationX,
        event.translationY,
        event.absoluteX,
        event.absoluteY
      );
    })
    .onEnd((event) => {
      checkSwipeAndNavigate(
        event.translationX,
        event.translationY,
        event.absoluteX,
        event.absoluteY
      );
    });

  return (
    <GestureDetector gesture={swipeToMessagesGesture}>
      <View style={styles.container} collapsable={false}>
        {/* ─── Header ─── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.headerLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{isThinking ? 'Planning' : 'Ready'}</Text>
          </View>
          <Text style={styles.headerTitle}>Space Time</Text>
          <Pressable
            style={styles.headerRight}
            onPress={() => router.push('/calendar')}
            accessibilityLabel="Open Calendar"
            accessibilityRole="button">
            <Text style={styles.calendarIcon}>⊞</Text>
          </Pressable>
        </View>

        {/* ─── Keyboard-avoiding container ─── */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : tabBarHeight}>

          {/* ─── Messages / Empty state ─── */}
          {isEmpty ? (
            <View style={styles.flex}>
              <EmptyState onSelectPrompt={(text) => handleSend(text)} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChatMessage message={item} />}
              ListFooterComponent={
                <>
                  {isThinking && <ThinkingIndicator />}
                  <View style={styles.bottomSpacer} />
                </>
              }
              style={styles.flex}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handleContentSizeChange}
            />
          )}

          {/* ─── Suggestion Chips ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
            keyboardShouldPersistTaps="always">
            {SUGGESTION_CHIPS.map((chip) => (
              <SuggestionChip
                key={chip}
                label={chip}
                onPress={() => handleSuggestionChip(chip)}
              />
            ))}
          </ScrollView>

          {/* ─── Composer ─── */}
          <ChatComposer
            value={input}
            onChangeText={setInput}
            onSend={() => handleSend()}
            disabled={isThinking}
            onVoicePress={() => void handleVoicePress()}
            onVoiceCancel={() => void handleVoiceCancel()}
            voiceState={
              isTranscribing
                ? 'transcribing'
                : isSpeechRecognizing || recorderState.isRecording
                  ? 'recording'
                  : 'idle'
            }
            voiceTranscript={isSpeechRecognizing ? liveTranscript : undefined}
            voiceReviewing={voiceReviewing}
            voiceError={voiceError}
          />
        </KeyboardAvoidingView>
      </View>
    </GestureDetector>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
