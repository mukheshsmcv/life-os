import { StyleSheet, Text, View } from 'react-native';
import { AIActionCard, ActionCardType } from './AIActionCard';


export type ChatNoticeType = 'mock_fallback' | 'ai_unavailable' | 'rate_limited' | 'info';

export type MessageAction = {
  cardType: ActionCardType;
  title?: string;
  durationMinutes?: number;
  date?: string | null;
  priority?: string;
  changeCount?: number;
};

export type ChatMessageData = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  notice?: string;
  noticeType?: ChatNoticeType;
  actions?: MessageAction[];
};

type Props = {
  message: ChatMessageData;
};

function formatNotice(notice: string, type?: ChatNoticeType): string {
  // Convert raw technical notices to user-friendly messages
  if (!notice) return notice;

  const lower = notice.toLowerCase();
  if (lower.includes('server offline') || lower.includes('server unreachable') || lower.includes('network')) {
    return 'AI is temporarily unavailable. Basic mode is active.';
  }
  if (lower.includes('rate') || lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    return 'AI is busy right now. Basic mode is active.';
  }
  if (lower.includes('gemini') || lower.includes('api error') || lower.includes('backend error')) {
    return 'AI had an issue. Basic mode is active.';
  }
  if (lower.includes('malformed') || lower.includes('schema mismatch')) {
    return 'AI response was unexpected. Basic mode is active.';
  }
  if (lower.includes('basic command mode') || lower.includes('basic mode')) {
    return 'Running in basic mode';
  }
  return notice;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // Assistant message
  return (
    <View style={styles.assistantRow}>
      {message.notice ? (
        <View style={styles.noticeRow}>
          <View style={styles.noticeBadge}>
            <Text style={styles.noticeDot}>⚡</Text>
            <Text style={styles.noticeText}>{formatNotice(message.notice, message.noticeType)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{message.text}</Text>

        {message.actions && message.actions.length > 0 && (
          <View style={styles.cardsContainer}>
            {message.actions.map((action, i) => (
              <AIActionCard
                key={i}
                type={action.cardType}
                title={action.title}
                durationMinutes={action.durationMinutes}
                date={action.date}
                priority={action.priority}
                changeCount={action.changeCount}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // User
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#A7A0FF',
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '82%',
  },
  userText: {
    color: '#0B0D10',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },

  // Assistant
  assistantRow: {
    alignItems: 'flex-start',
    gap: 4,
  },
  assistantBubble: {
    backgroundColor: '#171A20',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '92%',
  },
  assistantText: {
    color: '#E8E9EC',
    fontSize: 15,
    lineHeight: 22,
  },
  cardsContainer: {
    marginTop: 4,
    gap: 6,
  },

  // Notice
  noticeRow: {
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  noticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E1A0A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3A2F10',
  },
  noticeDot: {
    fontSize: 11,
  },
  noticeText: {
    color: '#B8960C',
    fontSize: 11,
    fontWeight: '600',
  },
});
