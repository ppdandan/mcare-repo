import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export default function ScreenHeader({ title, subtitle, action, centered = false }: { title: string; subtitle?: string; action?: ReactNode; centered?: boolean }) {
  return (
    <View style={[styles.header, centered && styles.centered]}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, centered && styles.centerText]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, centered && styles.centerText]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md },
  centered: { alignSelf: 'stretch', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.heading, color: colors.text, fontWeight: '800', flexShrink: 1 },
  subtitle: { ...typography.small, color: colors.textSecondary },
  centerText: { textAlign: 'center' },
});
