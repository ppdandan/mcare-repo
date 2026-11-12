import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import type { TextInputProps, ViewStyle } from 'react-native';
import type { Ref } from 'react';
import { colors, radius, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  inputRef?: Ref<TextInput>;
};

export default function TextField({ label, error, containerStyle, leadingIcon, trailing, inputRef, onFocus, onBlur, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.control, focused && styles.focused, error && styles.invalid]}>
        {leadingIcon}
        <TextInput
          ref={inputRef}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityState={{ disabled: props.editable === false }}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.small, color: colors.text, fontWeight: '600' },
  control: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  input: {
    minWidth: 0,
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  invalid: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error },
});
