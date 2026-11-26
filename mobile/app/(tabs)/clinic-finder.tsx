import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors as Colors, spacing, typography, radius } from '@/theme';
import { CLINIC_INFO } from '../index';

export default function ClinicFinderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeAreaContainer} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Our Clinic</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <View style={styles.infoIconBadge}>
            <Ionicons name="location-sharp" size={24} color={Colors.primary} />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.clinicName}>{CLINIC_INFO.name}</Text>
          <View style={styles.divider} />
          <View style={styles.contactRow}>
            <View style={styles.contactIconBadge}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.contactBody}>
              <Text style={styles.contactLabel}>Address</Text>
              <Text style={styles.contactText}>{CLINIC_INFO.address}</Text>
            </View>
          </View>
          <View style={styles.contactRow}>
            <View style={styles.contactIconBadge}>
              <Ionicons name="call-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.contactBody}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactText}>{CLINIC_INFO.phone}</Text>
            </View>
          </View>
          <View style={styles.contactRow}>
            <View style={styles.contactIconBadge}>
              <Ionicons name="mail-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.contactBody}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactText}>{CLINIC_INFO.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.hoursCard}>
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.hoursLabel}>Consultation hours</Text>
          </View>
          <Text style={styles.hoursValue}>Monday to Friday, by appointment</Text>
        </View>

        <Text style={styles.hoursNote}>
          Book your visit from the Book Appointment screen, or report a walk-in visit under My Clinic Visits.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  logoRow: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  infoIconBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: Colors.brandWash,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.background,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  clinicName: {
    fontSize: typography.subhead.fontSize,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  contactIconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: Colors.brandWash,
    marginRight: spacing.md,
  },
  contactBody: {
    flex: 1,
    paddingTop: 2,
  },
  contactLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  contactText: {
    fontSize: typography.small.fontSize,
    lineHeight: typography.small.fontSize * 1.45,
    color: Colors.text,
  },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.brandWash,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hoursLabel: {
    marginLeft: spacing.sm,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.text,
  },
  hoursValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  hoursNote: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.fontSize * 1.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
