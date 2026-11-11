import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, borderCurve: 'continuous' },
  label: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
});
