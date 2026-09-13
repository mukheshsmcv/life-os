import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { validateAction } from '@/ai/action-validator';
import { executeAction } from '@/ai/action-executor';
import { parseIntentWithAI } from '@/ai/ai-client';
import { AIAction } from '@/ai/ai-types';
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
  'Add task',
  'Replan evening',
];

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
  const { tasks, addTask, completeTask, skipTask, deleteTask } = useTasks();

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll when messages change or thinking state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, isThinking]);

  // ─── Send message ───────────────────────────────────────────────────────────
  const handleSend = async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if (!userText || isThinking) return;

    setInput('');
    Keyboard.dismiss();

    const userMessage: ChatMessageData = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);

    try {
      const parseResult = await parseIntentWithAI(userText, {
        tasks,
        currentDate: getTodayString(),
        currentTime: getCurrentTimeStringIST(),
        timezone: 'Asia/Kolkata',
      });

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

      // Execute each action and collect results
      const replyLines: string[] = [];
      const cards: MessageAction[] = [];

      for (const action of parseResult.actions) {
        const validation = validateAction(action, tasks);

        if (!validation.valid) {
          replyLines.push(validation.error);
          continue;
        }

        const execution = executeAction(validation.action, {
          tasks,
          operations: { addTask, completeTask, skipTask, deleteTask },
          currentTime: new Date(),
        });

        replyLines.push(execution.message);

        // Build inline action card from original action (before validation rewrites)
        const card = actionToCard(action);
        if (card) {
          // Enrich with resolved title for ref-based actions
          if (
            !card.title &&
            (action.type === 'complete_task' ||
              action.type === 'skip_task' ||
              action.type === 'delete_task')
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
          text: 'Something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSuggestionChip = (label: string) => {
    const chipTexts: Record<string, string> = {
      "What's next?": "What's next on my schedule?",
      'Plan my day': 'Plan my day',
      'Free time': 'How much free time do I have today?',
      'Add task': 'Add a task',
      'Replan evening': 'Replan my evening',
    };
    const text = chipTexts[label] ?? label;
    handleSend(text);
  };

  // ─── Left-edge swipe gesture → Calendar ────────────────────────────────────
  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((event) => {
      // Only trigger if started near the left edge and had meaningful rightward movement
      const startX = event.x - event.translationX;
      const isLeftEdge = startX < 45;
      const hasRightwardSwipe = event.translationX > 65;
      const isMoreHorizontalThanVertical =
        Math.abs(event.translationX) > Math.abs(event.translationY) * 1.4;

      if (isLeftEdge && hasRightwardSwipe && isMoreHorizontalThanVertical) {
        router.push('/calendar');
      }
    });

  const isEmpty = messages.length === 0;

  // Bottom padding: native tab bar on Android is approximately 80px
  const tabBarHeight = Platform.OS === 'android' ? 80 : 50;

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        {/* ─── Header ─── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.headerLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{isThinking ? 'Planning' : 'Ready'}</Text>
          </View>
          <Text style={styles.headerTitle}>Life OS</Text>
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
            <ScrollView
              ref={scrollViewRef}
              style={styles.flex}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: false })
              }>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isThinking && <ThinkingIndicator />}
              {/* bottom spacer so last message isn't at the edge */}
              <View style={styles.bottomSpacer} />
            </ScrollView>
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
