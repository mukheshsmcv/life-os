import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
};

export function SuggestionChip({ label, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#171A20',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#252932',
  },
  chipPressed: {
    backgroundColor: '#252932',
    borderColor: '#A7A0FF',
  },
  label: {
    color: '#B0B4BB',
    fontSize: 13,
    fontWeight: '500',
  },
});
