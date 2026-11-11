import { spacing, typography, radius } from '@m-care/shared';
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/Colors';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IndexScreen() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  // Animations
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance animation: Fade & Spring Up
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 900,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Gentle breathing pulse on maternal icon
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [logoOpacity, logoScale, textOpacity, pulseAnim]);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (!loading) {
      timer = setTimeout(() => {
        if (!isMounted) return;
        if (session && profile?.role === 'patient') {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(auth)/welcome');
        }
      }, 1200);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [session, profile, loading, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {/* Background Soft Glow Circles */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      {/* Animated Maternal Silhouette Badge */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }],
          },
        ]}
      >
        <Image
          source={require('../assets/logo.png')}
          accessibilityLabel="M-Care logo"
          resizeMode="contain"
          style={{ width: 140, height: 164 }}
        />
      </Animated.View>

      {/* Brand Title and Subtitle Animation */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.clinicName}>M-CARE</Text>
        <Text style={styles.clinicSpecialty}>OB-GYNE CLINIC & ULTRASOUND</Text>
        <Text style={styles.clinicLocation}>Balibago, Angeles City</Text>

        <View style={styles.loadingPill}>
          <View style={styles.dot} />
          <Text style={styles.loadingText}>Connecting to care…</Text>
        </View>
      </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.brandWash,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brandWash,
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: radius.full,
    backgroundColor: Colors.brandSoft,
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: radius.full,
    backgroundColor: Colors.brandSoft,
    opacity: 0.4,
  },
  logoContainer: {
    marginBottom: 0,
  },
  textContainer: {
    alignItems: 'center',
  },
  clinicName: {
    fontSize: typography.largeTitle.fontSize,
    fontWeight: '900',
    color: Colors.primaryDark,
    letterSpacing: 2.5,
  },
  clinicSpecialty: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  clinicLocation: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
    color: Colors.textLight,
    marginTop: spacing.xs,
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: Colors.primary,
    marginRight: spacing.sm,
  },
  loadingText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
});
