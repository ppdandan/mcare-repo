import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive';

const variantStyles: Record<Variant, { backgroundColor: string; borderColor: string; textColor: string }> = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, textColor: colors.textOnPrimary },
  secondary: { backgroundColor: colors.secondary, borderColor: colors.secondary, textColor: colors.textOnPrimary },
  outline: { backgroundColor: 'transparent', borderColor: colors.primary, textColor: colors.primary },
  destructive: { backgroundColor: colors.error, borderColor: colors.error, textColor: colors.textOnPrimary },
};

export type ButtonProps = {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export default function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const palette = variantStyles[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading && <ActivityIndicator color={palette.textColor} size="small" accessibilityLabel="Loading" />}
      <Text style={[styles.label, { color: palette.textColor }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  label: { ...typography.small, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});
