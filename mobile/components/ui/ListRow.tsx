import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export default function ListRow({ title, subtitle, trailing, onPress, accessibilityLabel, selected, style }: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
  style?: ViewStyle;
}) {
  const content = (
    <>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = ({ pressed }: { pressed: boolean }) => [styles.row, selected && styles.selected, pressed && styles.pressed, style];
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={rowStyle}
    >{content}</Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderCurve: 'continuous' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.body, color: colors.text, fontWeight: '600', flexShrink: 1 },
  subtitle: { ...typography.small, color: colors.textSecondary },
  selected: { borderColor: colors.primary, backgroundColor: colors.brandWash },
  pressed: { opacity: 0.82 },
});
