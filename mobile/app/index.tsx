import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/Colors';
import PregnantWomanLogo from '@/components/PregnantWomanLogo';

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
    let timer: NodeJS.Timeout | null = null;

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
        <PregnantWomanLogo size={110} />
      </Animated.View>

      {/* Brand Title and Subtitle Animation */}
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.clinicName}>M-CARE</Text>
        <Text style={styles.clinicSpecialty}>OB-GYNE CLINIC & ULTRASOUND</Text>
        <Text style={styles.clinicLocation}>Balibago, Angeles City</Text>

        <View style={styles.loadingPill}>
          <View style={styles.dot} />
          <Text style={styles.loadingText}>Connecting to care...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F9',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#FCE7F3',
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#FBCFE8',
    opacity: 0.4,
  },
  logoContainer: {
    marginBottom: 28,
  },
  textContainer: {
    alignItems: 'center',
  },
  clinicName: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.primaryDark,
    letterSpacing: 2.5,
  },
  clinicSpecialty: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  clinicLocation: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textLight,
    marginTop: 4,
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
});
