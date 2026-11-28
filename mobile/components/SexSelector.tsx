import { Text, View } from 'react-native';
import { sexOptions, type Sex } from '@m-care/shared';
import { Button } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export default function SexSelector({ value, onChange }: { value: Sex | null; onChange: (sex: Sex | null) => void }) {
  return <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
    <Text style={{ ...typography.body, color: colors.text }}>Sex (optional)</Text>
    <Text style={{ ...typography.small, color: colors.textSecondary }}>The clinic asks this for its patient demographics report.</Text>
    {[{ value: null, label: 'Not recorded' }, ...sexOptions].map(option =>
      <Button key={option.label} variant={value === option.value ? 'primary' : 'outline'}
        accessibilityLabel={option.label + (value === option.value ? ', selected' : '')}
        onPress={() => onChange(option.value)}>{option.label}</Button>)}
  </View>;
}
