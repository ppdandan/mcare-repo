import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export default function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, borderCurve: 'continuous' },
  title: { ...typography.subhead, color: colors.text, fontWeight: '700', textAlign: 'center' },
  description: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
});
