import { spacing, typography, radius } from '@/theme';
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors as Colors } from '@/theme';
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
}

// Clinic information constants
export const CLINIC_INFO = {
  name: "M-CARE OB-GYNE CLINIC",
  address: "5H9Q+3XG, Aniceto Gueco Street, Balibago, Angeles City, Pampanga",
  coordinates: { lat: 15.1475, lng: 120.5070 }, // Approximate Balibago, Angeles City
  phone: "09319286980",
  email: "clinic@m-care.com"
};