import { useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessenger, TEST_USER } from '@/contexts/messenger-context';

export default function MessengerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversations, createConversation, isLoading } = useMessenger();

  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreateTestConversation = () => {
    const id = createConversation(TEST_USER.id);
    router.push(`/messenger/${id}` as any);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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
      if (isNegativeSwipe) {
        hasNavigatedRef.current = true;
        router.navigate('/chat');
      } else if (isPositiveSwipe) {
        hasNavigatedRef.current = true;
        router.navigate('/tasks');
      }
    }
  };

  const swipeGesture = Gesture.Pan()
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
    <GestureDetector gesture={swipeGesture}>
      <View style={[styles.container, { paddingTop: insets.top }]} collapsable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Messenger</Text>
      </View>

      {sortedConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Start a chat to plan with friends.</Text>
          <Pressable style={styles.createButton} onPress={handleCreateTestConversation}>
            <Text style={styles.createButtonText}>Start Test Chat</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sortedConversations.map((conv) => {
            return (
              <Pressable
                key={conv.id}
                style={styles.conversationItem}
                onPress={() => router.push(`/messenger/${conv.id}` as any)}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{TEST_USER.displayName[0]}</Text>
                </View>
                <View style={styles.conversationDetails}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.participantName}>{TEST_USER.displayName}</Text>
                    <Text style={styles.timeText}>
                      {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conv.lastMessageText || 'New conversation'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          
          <Pressable style={[styles.createButton, { margin: 20 }]} onPress={handleCreateTestConversation}>
            <Text style={styles.createButtonText}>New Test Chat</Text>
          </Pressable>
        </ScrollView>
      )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#252932' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  loadingText: { color: '#858A94', textAlign: 'center', marginTop: 40 },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#858A94', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  
  createButton: { backgroundColor: '#A7A0FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  createButtonText: { color: '#0B0D10', fontSize: 16, fontWeight: '700' },

  list: { paddingVertical: 10 },
  conversationItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#252932', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  conversationDetails: { flex: 1 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  participantName: { color: '#E8E9EC', fontSize: 17, fontWeight: '600' },
  timeText: { color: '#737983', fontSize: 13 },
  lastMessage: { color: '#858A94', fontSize: 15 },
});
