import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';

interface PregnantWomanLogoProps {
  size?: number;
  color?: string;
  badgeBackground?: string;
}

/**
 * Modern Maternal / Pregnant Woman Silhouette Badge
 * Designed specifically for M-Care OB-GYN & Ultrasound Clinic.
 * Features the graceful contour of an expectant mother with gentle fetal curves.
 */
export default function PregnantWomanLogo({
  size = 72,
  color = '#FFFFFF',
  badgeBackground = Colors.primary,
}: PregnantWomanLogoProps) {
  const headSize = size * 0.22;
  const hairSize = size * 0.16;
  const bellySize = size * 0.42;
  const heartSize = size * 0.14;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: badgeBackground,
        },
      ]}
    >
      <View style={styles.figureWrap}>
        {/* Mother's Head */}
        <View
          style={[
            styles.head,
            {
              width: headSize,
              height: headSize,
              borderRadius: headSize / 2,
              backgroundColor: color,
              top: size * 0.16,
              left: size * 0.38,
            },
          ]}
        />

        {/* Soft Hair Sweep */}
        <View
          style={[
            styles.hair,
            {
              width: hairSize,
              height: hairSize * 1.5,
              borderTopRightRadius: hairSize,
              borderBottomRightRadius: hairSize,
              backgroundColor: color,
              opacity: 0.9,
              top: size * 0.18,
              left: size * 0.34,
            },
          ]}
        />

        {/* Mother's Graceful Curved Back */}
        <View
          style={[
            styles.torsoBack,
            {
              width: size * 0.15,
              height: size * 0.38,
              borderTopLeftRadius: size * 0.15,
              borderBottomLeftRadius: size * 0.12,
              backgroundColor: color,
              top: size * 0.36,
              left: size * 0.30,
            },
          ]}
        />

        {/* Expectant Baby Bump / Belly */}
        <View
          style={[
            styles.belly,
            {
              width: bellySize,
              height: bellySize,
              borderRadius: bellySize / 2,
              backgroundColor: color,
              top: size * 0.36,
              left: size * 0.34,
            },
          ]}
        />

        {/* Caring Arm & Hand Gentle Hold */}
        <View
          style={[
            styles.arm,
            {
              width: size * 0.32,
              height: size * 0.10,
              borderRadius: size * 0.05,
              backgroundColor: badgeBackground,
              transform: [{ rotate: '36deg' }],
              top: size * 0.46,
              left: size * 0.33,
            },
          ]}
        />

        {/* Heart Accent on Baby Bump */}
        <View
          style={[
            styles.heartGlow,
            {
              width: heartSize,
              height: heartSize,
              borderRadius: heartSize / 2,
              backgroundColor: '#FFFFFF',
              top: size * 0.50,
              left: size * 0.48,
              opacity: 0.95,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  figureWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  head: {
    position: 'absolute',
  },
  hair: {
    position: 'absolute',
  },
  torsoBack: {
    position: 'absolute',
  },
  belly: {
    position: 'absolute',
  },
  arm: {
    position: 'absolute',
  },
  heartGlow: {
    position: 'absolute',
  },
});
