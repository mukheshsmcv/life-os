import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { validateAction } from '@/ai/action-validator';
import { executeAction } from '@/ai/action-executor';
import { ChatMessage } from '@/ai/ai-types';
import { parseIntentWithAI } from '@/ai/ai-client';
import { useTasks } from '@/contexts/tasks-context';
import { getTodayString, getCurrentTimeStringIST } from '@/lib/date-time';

export default function ChatScreen() {
  const { tasks, addTask, completeTask, skipTask, deleteTask } = useTasks();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Hello Mukhesh! I am your Life OS assistant. How can I help you plan or manage your day?',
      timestamp: new Date(),
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText) return;

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setInput('');
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Pipeline processing: User Message -> LLM API -> Structured Actions -> Validator -> Executor -> Application State & Scheduler
    const parseResult = await parseIntentWithAI(userText, {
      tasks,
      currentDate: getTodayString(),
      currentTime: getCurrentTimeStringIST(),
      timezone: 'Asia/Kolkata',
    });

    if (!parseResult.success) {
      const assistantMessage: ChatMessage = {
        id: `msg-ast-${Date.now()}`,
        sender: 'assistant',
        text: parseResult.error,
        timestamp: new Date(),
        notice: parseResult.notice,
      };
      setMessages([...newMessages, assistantMessage]);
      return;
    }

    const assistantReplies: string[] = [];

    for (const action of parseResult.actions) {
      const validation = validateAction(action, tasks);

      if (!validation.valid) {
        assistantReplies.push(validation.error);
        continue;
      }

      const execution = executeAction(validation.action, {
        tasks,
        operations: { addTask, completeTask, skipTask, deleteTask },
        currentTime: new Date(),
      });

      assistantReplies.push(execution.message);
    }

    const assistantMessage: ChatMessage = {
      id: `msg-ast-${Date.now()}`,
      sender: 'assistant',
      text: assistantReplies.join('\n\n'),
      timestamp: new Date(),
      notice: parseResult.notice,
    };

    setMessages([...newMessages, assistantMessage]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI PLANNER</Text>
          <Text style={styles.title}>Assistant</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((msg) => (
            <View key={msg.id} style={{ alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.notice && (
                <View style={styles.noticeContainer}>
                  <Text style={styles.noticeText}>{msg.notice}</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  msg.sender === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}>
                <Text style={msg.sender === 'user' ? styles.userText : styles.assistantText}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Life OS... (e.g. I completed pharmacology)"
            placeholderTextColor="#737983"
            style={styles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#191C22',
  },
  eyebrow: { color: '#A7A0FF', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 2 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 20, gap: 14 },
  noticeContainer: {
    backgroundColor: '#261F12',
    borderWidth: 1,
    borderColor: '#4A3B18',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  noticeText: { color: '#FCD34D', fontSize: 12, fontWeight: '600' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#171A20',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#A7A0FF',
    borderTopRightRadius: 4,
  },
  assistantText: { color: '#E8E9EC', fontSize: 15, lineHeight: 21 },
  userText: { color: '#0B0D10', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#191C22',
    backgroundColor: '#0B0D10',
  },
  input: {
    flex: 1,
    backgroundColor: '#171A20',
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendButtonText: { color: '#0B0D10', fontWeight: '700', fontSize: 14 },
});
