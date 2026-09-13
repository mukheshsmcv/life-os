import { useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputContentSizeChangeEventData,
  View,
} from 'react-native';

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 120;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  onVoicePress?: () => void;
  voiceState?: 'idle' | 'recording' | 'transcribing';
  voiceError?: string | null;
};

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  placeholder,
  onVoicePress,
  voiceState = 'idle',
  voiceError,
}: Props) {
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const canSend = value.trim().length > 0 && !disabled;
  const voiceDisabled = disabled || voiceState === 'transcribing';

  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const h = Math.min(Math.max(e.nativeEvent.contentSize.height, MIN_HEIGHT), MAX_HEIGHT);
    setInputHeight(h);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? 'Tell Life OS what you want…'}
          placeholderTextColor="#4A5060"
          style={[styles.input, { height: inputHeight }]}
          multiline
          onContentSizeChange={handleContentSizeChange}
          returnKeyType="default"
          blurOnSubmit={false}
          accessibilityLabel="Chat input"
          editable={!disabled}
        />
        {onVoicePress && (
          <Pressable
            style={[
              styles.voiceButton,
              voiceState === 'recording' && styles.voiceButtonRecording,
              voiceDisabled && styles.voiceButtonDisabled,
            ]}
            onPress={voiceDisabled ? undefined : onVoicePress}
            accessibilityRole="button"
            accessibilityLabel={voiceState === 'recording' ? 'Stop recording' : 'Record voice command'}
            accessibilityState={{ disabled: voiceDisabled }}>
            <Text style={styles.voiceText}>
              {voiceState === 'transcribing' ? '...' : voiceState === 'recording' ? 'Stop' : 'Mic'}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={canSend ? onSend : undefined}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}>
          <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>↑</Text>
        </Pressable>
      </View>
      {voiceError && <Text style={styles.voiceError}>{voiceError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
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
