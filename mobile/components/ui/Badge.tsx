import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
const tones: Record<Tone, { background: string; foreground: string }> = {
  primary: { background: colors.brandSoft, foreground: colors.primaryDark },
  success: { background: colors.successBackground, foreground: colors.success },
  warning: { background: colors.warningBackground, foreground: colors.warning },
  error: { background: colors.errorBackground, foreground: colors.error },
  info: { background: colors.infoBackground, foreground: colors.info },
  neutral: { background: colors.surfaceAlt, foreground: colors.text },
};

export default function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <View accessibilityRole="text" style={[styles.badge, { backgroundColor: tones[tone].background }]}>
      <Text style={[styles.text, { color: tones[tone].foreground }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  text: { ...typography.caption, fontWeight: '700' },
});
