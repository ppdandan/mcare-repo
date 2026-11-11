import { StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { colors, radius, spacing, typography } from '@/theme';

export default function ErrorState({ title, message, onRetry, retryLabel = 'Retry' }: { title: string; message: string; onRetry: () => void; retryLabel?: string }) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Button variant="outline" onPress={onRetry}>{retryLabel}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.errorBackground, borderColor: colors.error, borderWidth: 1, borderRadius: radius.lg, borderCurve: 'continuous' },
  title: { ...typography.subhead, color: colors.error, fontWeight: '700' },
  message: { ...typography.small, color: colors.text },
});
