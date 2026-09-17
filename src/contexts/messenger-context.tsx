import React, { createContext, useContext, useEffect, useState, useRef, PropsWithChildren } from 'react';
import { loadMessengerStorageState, saveMessengerStorageState } from '@/lib/storage/messenger-storage';

export type User = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};

export type Conversation = {
  id: string;
  type: 'direct';
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
  lastMessageId?: string;
  lastMessageText?: string;
  unreadCount?: number;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: number;
  readAt?: number;
};

// V1 Development Identity
export function getCurrentUserId() {
  return 'dev_me_123';
}

// Development Test User
export const TEST_USER: User = {
  id: 'test_user_456',
  displayName: 'Test User',
};

type MessengerContextValue = {
  conversations: Conversation[];
  messages: Message[];
  isLoading: boolean;
  createConversation: (participantId: string) => string;
  sendMessage: (conversationId: string, text: string) => void;
  getMessagesForConversation: (conversationId: string) => Message[];
};

const MessengerContext = createContext<MessengerContextValue | undefined>(undefined);

export function MessengerProvider({ children }: PropsWithChildren) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const conversationsRef = useRef<Conversation[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const state = await loadMessengerStorageState();
      if (mounted) {
        if (state) {
          setConversations(state.conversations);
          setMessages(state.messages);
          conversationsRef.current = state.conversations;
          messagesRef.current = state.messages;
        }
        setIsLoading(false);
      }
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = (nextConversations: Conversation[], nextMessages: Message[]) => {
    saveMessengerStorageState(nextConversations, nextMessages);
  };

  const createConversation = (participantId: string) => {
    const existing = conversationsRef.current.find(
      (c) => c.type === 'direct' && c.participantIds.includes(participantId)
    );
    if (existing) return existing.id;

    const newId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newConv: Conversation = {
      id: newId,
      type: 'direct',
      participantIds: [getCurrentUserId(), participantId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nextConversations = [...conversationsRef.current, newConv];
    conversationsRef.current = nextConversations;
    setConversations(nextConversations);
    persist(nextConversations, messagesRef.current);
    
    return newId;
  };

  const sendMessage = (conversationId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId: getCurrentUserId(),
      text: trimmed,
      createdAt: Date.now(),
    };

    const nextMessages = [...messagesRef.current, newMessage];
    
    const nextConversations = conversationsRef.current.map((c) => {
      if (c.id === conversationId) {
        return {
          ...c,
          lastMessageId: newMessage.id,
          lastMessageText: newMessage.text,
          updatedAt: newMessage.createdAt,
        };
      }
      return c;
    });

    messagesRef.current = nextMessages;
    conversationsRef.current = nextConversations;
    
    setMessages(nextMessages);
    setConversations(nextConversations);
    persist(nextConversations, nextMessages);
  };

  const getMessagesForConversation = (conversationId: string) => {
    return messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt);
  };

  const value = {
    conversations,
    messages,
    isLoading,
    createConversation,
    sendMessage,
    getMessagesForConversation,
  };

  return <MessengerContext.Provider value={value}>{children}</MessengerContext.Provider>;
}

export function useMessenger() {
  const context = useContext(MessengerContext);
  if (context === undefined) {
    throw new Error('useMessenger must be used within a MessengerProvider');
  }
  return context;
}
