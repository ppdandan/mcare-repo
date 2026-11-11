import { spacing, typography, radius } from '@m-care/shared';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Brand Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            accessibilityLabel="M-Care logo"
            resizeMode="contain"
            style={{ width: 88, height: 103 }}
          />
          <Text style={styles.clinicTitle}>M-CARE</Text>
          <Text style={styles.clinicSubtitle}>OB-GYN Clinic & Ultrasound</Text>
          <Text style={styles.location}>Balibago, Angeles City, Pampanga</Text>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroHeading}>
            Compassionate Care for Every Stage of Womanhood
          </Text>
          <Text style={styles.heroText}>
            Welcome to the official M-Care Patient Mobile Portal. Book appointments,
            check doctor availability in real-time, and view your confidential
            visit records with ease.
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>Real-time appointment slot booking</Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>Ultrasonography & prenatal care tracking</Text>
            </View>
            <View style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>Strict Data Privacy Act of 2012 protection</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Sign In to My Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Create New Patient Account</Text>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            Republic Act No. 10173 • Philippine Data Privacy Act Compliant
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.brandWash,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: typography.largeTitle.fontSize,
    fontWeight: 'bold',
    color: Colors.background,
  },
  clinicTitle: {
    fontSize: typography.display.fontSize,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1.5,
  },
  clinicSubtitle: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  location: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  heroCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  heroHeading: {
    fontSize: typography.subhead.fontSize,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: spacing.sm,
    lineHeight: typography.body.lineHeight,
  },
  heroText: {
    fontSize: typography.small.fontSize,
    color: Colors.textSecondary,
    lineHeight: typography.small.lineHeight,
    marginBottom: spacing.lg,
  },
  bulletList: {
    marginTop: spacing.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: Colors.primary,
    marginRight: spacing.sm,
  },
  bulletText: {
    fontSize: typography.caption.fontSize,
    color: Colors.text,
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    color: Colors.background,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: Colors.background,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: spacing.lg,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: typography.small.fontSize,
    fontWeight: '700',
  },
  privacyNote: {
    fontSize: typography.caption.fontSize,
    color: Colors.textLight,
    textAlign: 'center',
  },
});

