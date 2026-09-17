import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessenger, TEST_USER } from '@/contexts/messenger-context';
import { useTasks } from '@/contexts/tasks-context';
import { parseIntentWithAI } from '@/ai/ai-client';
import { executeAction } from '@/ai/action-executor';
import { AIAction } from '@/ai/ai-types';

type TransientLifeOSCard = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: number;
};

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const { conversations, getMessagesForConversation, sendMessage } = useMessenger();
  const { addTask, addEvent } = useTasks();

  const [input, setInput] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  
  // Proposal State
  const [pendingProposal, setPendingProposal] = useState<AIAction | null>(null);
  const [pendingClarification, setPendingClarification] = useState<import('@/ai/ai-types').PendingClarification | null>(null);
  const [isChangingProposal, setIsChangingProposal] = useState(false);
  const [changeInput, setChangeInput] = useState('');
  const [baseContextString, setBaseContextString] = useState('');

  // System Cards State (Transient)
  const [systemCards, setSystemCards] = useState<TransientLifeOSCard[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);

  const conversation = conversations.find(c => c.id === id);
  const messages = getMessagesForConversation(id);

  const renderItems = [
    ...messages.map(m => ({ type: 'message' as const, data: m, time: m.createdAt })),
    ...systemCards.map(s => ({ type: 'system' as const, data: s, time: s.createdAt }))
  ].sort((a, b) => a.time - b.time);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [renderItems.length]);

  if (!conversation) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Conversation not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(id, input);
    setInput('');
  };

  const handlePlanWithLifeOS = async () => {
    if (messages.length === 0) {
      Alert.alert('Not enough context', 'Send some messages first.');
      return;
    }

    setIsPlanning(true);
    Keyboard.dismiss();
    
    // Build context string from the last 10 messages
    const recent = messages.slice(-10);
    const contextLines = recent.map(m => {
      const name = m.senderId === TEST_USER.id ? TEST_USER.displayName : 'Me';
      return `${name}:\n${m.text}`;
    });
    const contextString = `Context: Planning with ${TEST_USER.displayName}\n\n` + contextLines.join('\n\n');
    setBaseContextString(contextString);

    await executeAI(contextString, null);
  };

  const executeAI = async (contextString: string, currentClarification: import('@/ai/ai-types').PendingClarification | null) => {
    setIsPlanning(true);
    try {
      const result = await parseIntentWithAI(contextString, { 
        tasks: [],
        pendingClarification: currentClarification
      });
      
      if (result.pendingClarification) {
        setPendingClarification(result.pendingClarification);
        setPendingProposal(null);
        setIsChangingProposal(true);
      } else if (result.success && result.actions.length > 0) {
        const action = result.actions[0];
        
        if (action.type === 'process_intent' && (action.payload.operation === 'general_conversation' || action.payload.operation === 'context_statement')) {
          Alert.alert('No scheduling required', action.payload.conversationalResponse || 'There is no actionable plan here.');
          return;
        }

        if (action.type === 'create_task' || action.type === 'process_intent') {
          setPendingProposal(action);
          setPendingClarification(null);
          setIsChangingProposal(false);
          setChangeInput('');
        } else {
          Alert.alert('No clear plan identified', 'The AI did not propose a supported scheduling action.');
        }
      } else {
        Alert.alert('No clear plan identified', 'The AI did not propose a scheduling action.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to Space Time AI.');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleChangeSubmit = async () => {
    if (!changeInput.trim()) return;
    const updateText = changeInput.trim();
    Keyboard.dismiss();
    
    // Construct new context that tells the AI about the correction
    let newContext = baseContextString;
    if (pendingProposal && pendingProposal.type === 'create_task') {
      newContext += `\n\nAI Proposal: ${pendingProposal.payload.title} at ${pendingProposal.payload.date || 'flexible'}`;
    }
    newContext += `\n\nMe (correction):\n${updateText}`;
    
    // If we have a pending clarification, we might want to pass it directly, 
    // but the context string + the original clarification object is fine.
    await executeAI(newContext, pendingClarification);
  };

  const handleConfirm = () => {
    if (!pendingProposal) return;
    
    executeAction(pendingProposal, {
      tasks: [], 
      events: [],
      operations: {
        addTask: addTask as any,
        addEvent: addEvent as any,
        completeTask: () => {},
        skipTask: () => {},
        deleteTask: () => {},
      }
    });

    // Clear proposal UI
    const title = pendingProposal.type === 'process_intent' 
      ? pendingProposal.payload.title || 'Activity'
      : (pendingProposal as any).payload?.title || 'Activity';
      
    const date = pendingProposal.type === 'process_intent' 
      ? pendingProposal.payload.scheduling?.date 
      : (pendingProposal as any).payload?.date;

    setPendingProposal(null);
    setPendingClarification(null);
    setIsChangingProposal(false);

    let finalSubtitle = '';
    if (date) {
      finalSubtitle = date;
      if (TEST_USER.displayName) {
        finalSubtitle += ` · ${TEST_USER.displayName}`;
      }
    } else {
      if (TEST_USER.displayName) {
        finalSubtitle = TEST_USER.displayName;
      }
    }

    // Render system card
    setSystemCards(prev => [...prev, {
      id: `sys_${Date.now()}`,
      title,
      subtitle: finalSubtitle,
      createdAt: Date.now()
    }]);
  };

  const handleCancelProposal = () => {
    setPendingProposal(null);
    setPendingClarification(null);
    setIsChangingProposal(false);
    setChangeInput('');
  };

  // Extract info for the proposal card
  let proposalTitle = '';
  let proposalSubtitle = '';
  if (pendingProposal) {
    if (pendingProposal.type === 'process_intent') {
      proposalTitle = pendingProposal.payload.title || 'Untitled';
      proposalSubtitle = pendingProposal.payload.scheduling?.date || 'Unscheduled';
    } else if (pendingProposal.type === 'create_task') {
      proposalTitle = pendingProposal.payload.title || 'Untitled';
      proposalSubtitle = pendingProposal.payload.date || 'Unscheduled';
    }
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{TEST_USER.displayName}</Text>
        </View>
        <Pressable onPress={handlePlanWithLifeOS} style={styles.planButton} disabled={isPlanning}>
          <Text style={styles.planButtonText}>{isPlanning ? 'Thinking...' : 'Plan'}</Text>
        </Pressable>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.messageList}
        keyboardDismissMode="interactive"
      >
        {renderItems.map(item => {
          if (item.type === 'system') {
            const card = item.data as TransientLifeOSCard;
            return (
              <View key={card.id} style={styles.systemCardWrapper}>
                <View style={styles.systemCard}>
                  <Text style={styles.systemCardHeader}>LIFE OS</Text>
                  <Text style={styles.systemCardTitle}>{card.title}</Text>
                  {card.subtitle ? (
                    <Text style={styles.systemCardSubtitle}>{card.subtitle}</Text>
                  ) : null}
                  <View style={styles.systemCardLine} />
                  <Text style={styles.systemCardSuccess}>Added to your schedule ✓</Text>
                </View>
              </View>
            );
          }

          const msg = item.data as import('@/contexts/messenger-context').Message;
          const isMe = msg.senderId !== TEST_USER.id;
          return (
            <View key={msg.id} style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
              <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <Text style={styles.bubbleText}>{msg.text}</Text>
              </View>
              <Text style={styles.timeText}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* PROPOSAL UI OVERLAY */}
      {(pendingProposal || pendingClarification) && (
        <View style={styles.proposalOverlay}>
          <View style={styles.proposalCard}>
            <Text style={styles.proposalHeader}>PLAN WITH LIFE OS</Text>
            
            {pendingProposal && !isChangingProposal && (
              <>
                <Text style={styles.proposalTitle}>{proposalTitle}</Text>
                <Text style={styles.proposalSubtitle}>{proposalSubtitle}</Text>
                
                <View style={styles.proposalActions}>
                  <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.confirmButtonText}>Confirm & Schedule</Text>
                  </Pressable>
                  <View style={styles.proposalSecondaryActions}>
                    <Pressable style={styles.secondaryButton} onPress={() => setIsChangingProposal(true)}>
                      <Text style={styles.secondaryButtonText}>Change</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={handleCancelProposal}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {isChangingProposal && (
              <>
                {pendingClarification ? (
                  <Text style={styles.clarificationQuestion}>{pendingClarification.question}</Text>
                ) : (
                  <Text style={styles.clarificationQuestion}>What would you like to change?</Text>
                )}
                
                <View style={styles.changeComposer}>
                  <TextInput
                    style={styles.changeInput}
                    placeholder="e.g., Make it 2 PM..."
                    placeholderTextColor="#737983"
                    value={changeInput}
                    onChangeText={setChangeInput}
                    autoFocus
                  />
                  <Pressable style={styles.updateButton} onPress={handleChangeSubmit}>
                    <Text style={styles.updateButtonText}>Update</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.cancelChangeButton} onPress={handleCancelProposal}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* NORMAL CHAT COMPOSER */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#737983"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  errorText: { color: '#FF7B7B', textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#252932',
    backgroundColor: '#0B0D10',
    zIndex: 10,
  },
  backButton: { padding: 8, marginRight: 8 },
  backIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '300' },
  backText: { color: '#A7A0FF', textAlign: 'center', fontSize: 16, marginTop: 10 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  planButton: { backgroundColor: '#A7A0FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  planButtonText: { color: '#0B0D10', fontWeight: '700', fontSize: 13 },
  
  messageList: { padding: 16, paddingBottom: 32 },
  bubbleWrapper: { marginBottom: 16, maxWidth: '80%' },
  bubbleWrapperRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapperLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleRight: { backgroundColor: '#2B2F3A', borderBottomRightRadius: 4 },
  bubbleLeft: { backgroundColor: '#1A1D24', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  timeText: { color: '#737983', fontSize: 11, marginTop: 6, marginHorizontal: 4 },
  
  systemCardWrapper: { alignItems: 'center', marginVertical: 20, width: '100%' },
  systemCard: { backgroundColor: '#14171C', borderRadius: 16, padding: 16, width: '85%', borderWidth: 1, borderColor: '#252932' },
  systemCardHeader: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  systemCardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  systemCardSubtitle: { color: '#858A94', fontSize: 13 },
  systemCardLine: { height: 1, backgroundColor: '#252932', marginVertical: 12 },
  systemCardSuccess: { color: '#858A94', fontSize: 13, fontWeight: '500' },

  proposalOverlay: { 
    position: 'absolute', 
    bottom: 80, 
    left: 0, 
    right: 0, 
    padding: 16, 
    zIndex: 100 
  },
  proposalCard: {
    backgroundColor: '#171A20',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30343C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  proposalHeader: { color: '#A7A0FF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 },
  proposalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  proposalSubtitle: { color: '#858A94', fontSize: 15, marginBottom: 20 },
  
  proposalActions: { gap: 12 },
  confirmButton: { backgroundColor: '#A7A0FF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#0B0D10', fontSize: 16, fontWeight: '700' },
  proposalSecondaryActions: { flexDirection: 'row', gap: 12 },
  secondaryButton: { flex: 1, backgroundColor: '#252932', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#E8E9EC', fontSize: 15, fontWeight: '600' },

  clarificationQuestion: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginBottom: 16 },
  changeComposer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  changeInput: { flex: 1, backgroundColor: '#0B0D10', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#252932' },
  updateButton: { backgroundColor: '#A7A0FF', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12 },
  updateButtonText: { color: '#0B0D10', fontWeight: '700', fontSize: 14 },
  cancelChangeButton: { backgroundColor: 'transparent', paddingVertical: 8, alignItems: 'center' },

  composer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#252932',
    backgroundColor: '#0B0D10',
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1D24',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: { padding: 12, marginLeft: 8 },
  sendButtonText: { color: '#A7A0FF', fontSize: 16, fontWeight: '600' },
});
