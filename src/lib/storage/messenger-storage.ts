import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Conversation, Message } from '@/contexts/messenger-context';

export const CURRENT_MESSENGER_STORAGE_VERSION = 1;
export const MESSENGER_STORAGE_KEY = 'LIFE_OS_MESSENGER_STORAGE_V1';

export type MessengerStorageState = {
  version: number;
  conversations: Conversation[];
  messages: Message[];
};

const isWebServer = Platform.OS === 'web' && typeof document === 'undefined';

function isValidConversation(conv: unknown): conv is Conversation {
  if (!conv || typeof conv !== 'object') return false;
  const c = conv as Record<string, unknown>;
  if (typeof c.id !== 'string' || !c.id) return false;
  if (c.type !== 'direct') return false;
  if (!Array.isArray(c.participantIds) || c.participantIds.length === 0) return false;
  if (typeof c.createdAt !== 'number') return false;
  if (typeof c.updatedAt !== 'number') return false;
  if (c.lastMessageId !== undefined && c.lastMessageId !== null && typeof c.lastMessageId !== 'string') return false;
  if (c.lastMessageText !== undefined && c.lastMessageText !== null && typeof c.lastMessageText !== 'string') return false;
  if (c.unreadCount !== undefined && c.unreadCount !== null && typeof c.unreadCount !== 'number') return false;
  return true;
}

function isValidMessage(msg: unknown): msg is Message {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id) return false;
  if (typeof m.conversationId !== 'string' || !m.conversationId) return false;
  if (typeof m.senderId !== 'string' || !m.senderId) return false;
  if (typeof m.text !== 'string') return false;
  if (typeof m.createdAt !== 'number') return false;
  if (m.readAt !== undefined && m.readAt !== null && typeof m.readAt !== 'number') return false;
  return true;
}

export async function loadMessengerStorageState(): Promise<{ conversations: Conversation[]; messages: Message[] } | null> {
  if (isWebServer) return null;

  try {
    const jsonStr = await AsyncStorage.getItem(MESSENGER_STORAGE_KEY);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;

    const { version, conversations, messages } = parsed as Partial<MessengerStorageState>;
    if (typeof version !== 'number' || version < 1) return null;
    if (!Array.isArray(conversations) || !Array.isArray(messages)) return null;

    const validConversations: Conversation[] = [];
    for (const c of conversations) {
      if (isValidConversation(c)) {
        validConversations.push({
          id: c.id,
          type: c.type,
          participantIds: c.participantIds,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastMessageId: c.lastMessageId,
          lastMessageText: c.lastMessageText,
          unreadCount: c.unreadCount,
        });
      }
    }

    const validMessages: Message[] = [];
    for (const m of messages) {
      if (isValidMessage(m)) {
        validMessages.push({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          text: m.text,
          createdAt: m.createdAt,
          readAt: m.readAt,
        });
      }
    }

    return { conversations: validConversations, messages: validMessages };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MessengerStorage] Failed to load storage state:', error);
    }
    return null;
  }
}

export async function saveMessengerStorageState(conversations: Conversation[], messages: Message[]): Promise<boolean> {
  if (isWebServer) return true;

  try {
    const payload: MessengerStorageState = {
      version: CURRENT_MESSENGER_STORAGE_VERSION,
      conversations,
      messages,
    };
    await AsyncStorage.setItem(MESSENGER_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MessengerStorage] Failed to save storage state:', error);
    }
    return false;
  }
}
