import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(Platform.OS === 'ios' ? 300 : 300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true, easing: Animation.easing.out(Animation.easing.quad) }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: Platform.OS === 'ios' ? 300 : 300, duration: 200, useNativeDriver: true, easing: Animation.easing.in(Animation.easing.quad) }),
      ]).start(() => {});
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible && !transparent) return null;

  const containerStyle = [
    styles.container,
    style,
    {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    },
  ];

  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.overlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
            <Animated.View style={containerStyle} pointerEvents="box-only">
              {title && (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Close">
                    <View style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={24} color={Colors.textSecondary} />
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              )}
              <View style={styles.content}>{children}</View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const Animation = {
  timing: (config: { toValue: number; duration: number; useNativeDriver: boolean; easing?: any }) => config,
  parallel: (animations: any[]) => ({
    start: (callback?: () => void) => {
      setTimeout(() => callback?.(), 0);
    },
  }),
  easing: {
    out: (fn: any) => fn,
    in: (fn: any) => fn,
    quad: (t: number) => t * t,
  },
} as any;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.shadow,
    opacity: 0.5,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
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
    overflow: 'hidden',
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
    paddingVertical: spacing.md,
    paddingBottom: spacing['3xl'],
  },
});