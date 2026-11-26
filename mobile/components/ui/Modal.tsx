import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, radius, colors as Colors } from '@/theme';

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
  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Tapping the dimmed backdrop closes; tapping the sheet does not. */}
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.overlay}>
          <View style={styles.backdrop} pointerEvents="none" />
          <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
            <View style={[styles.container, style]}>
              {title ? (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <TouchableWithoutFeedback
                    onPress={onClose}
                    accessibilityLabel="Close"
                  >
                    <View
                      style={styles.closeButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={24} color={Colors.textSecondary} />
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              ) : null}
              {/* Body scrolls so tall forms are never clipped on small screens. */}
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentInner}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  contentInner: {
    paddingBottom: spacing['3xl'],
  },
});
