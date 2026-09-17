import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Prompt = {
  label: string;
  text: string;
};

const DEFAULT_PROMPTS: Prompt[] = [
  { label: 'Plan my day', text: 'Plan my day' },
  { label: 'Study anatomy tomorrow', text: 'I need to study anatomy tomorrow for an hour' },
  { label: "What's next?", text: "What's next on my schedule?" },
  { label: 'Find free time', text: 'Find free time in my schedule today' },
];

type Props = {
  onSelectPrompt: (text: string) => void;
};

export function EmptyState({ onSelectPrompt }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSymbol}>✦</Text>
        </View>
        <Text style={styles.brandName}>Space Time</Text>
        <Text style={styles.tagline}>Tell me what you want to get done.</Text>
      </View>

      <View style={styles.promptsArea}>
        <Text style={styles.promptsLabel}>Try asking</Text>
        <View style={styles.promptGrid}>
          {DEFAULT_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt.label}
              style={({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed]}
              onPress={() => onSelectPrompt(prompt.text)}
              accessibilityRole="button"
              accessibilityLabel={`Try: ${prompt.label}`}>
              <Text style={styles.promptText}>{prompt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 52,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#171A20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#252932',
  },
  logoSymbol: {
    color: '#A7A0FF',
    fontSize: 22,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#737983',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  promptsArea: {
    width: '100%',
    alignItems: 'center',
  },
  promptsLabel: {
    color: '#4A5060',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  promptChip: {
    backgroundColor: '#171A20',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#252932',
  },
  promptChipPressed: {
    backgroundColor: '#252932',
    borderColor: '#A7A0FF',
  },
  promptText: {
    color: '#B0B4BB',
    fontSize: 13,
    fontWeight: '500',
  },
});
