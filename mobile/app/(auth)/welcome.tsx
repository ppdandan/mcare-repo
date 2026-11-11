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
    backgroundColor: '#FFF7F9',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clinicTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1.5,
  },
  clinicSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  location: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  heroHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    lineHeight: 24,
  },
  heroText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  bulletList: {
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 10,
  },
  bulletText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 28,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  privacyNote: {
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
  },
});

