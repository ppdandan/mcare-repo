import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, radius, size, colors as Colors } from '@/theme';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  transparent?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  style?: any;
}

export function Modal({
  visible,
  onClose,
  title,
  children,
  transparent = true,
  animationType = 'slide',
  style,
}: ModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessible={false} style={styles.backdrop} onPress={onClose} />
        <View style={[styles.container, style]}>
          {title ? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentInner, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.shadow,
    opacity: 0.5,
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    width: '100%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    flex: 1,
    ...typography.title,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    minWidth: size.tapTarget,
    minHeight: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexGrow: 0, flexShrink: 1 },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
