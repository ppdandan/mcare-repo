import { spacing, typography, radius } from '@/theme';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { colors as Colors } from '@/theme';
import { formatManilaDateTime } from '@m-care/shared';
import type { AppointmentWithDetails } from '@m-care/shared';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile, patient, signOut, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<AppointmentWithDetails | null>(null);
  const [loadingAppt, setLoadingAppt] = useState(true);

  const fetchNextAppointment = useCallback(async () => {
    if (!patient?.id) {
      setLoadingAppt(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctor:doctors (
            *,
            profile:profiles (*)
          ),
          service:services (*)
        `)
        .eq('patient_id', patient.id)
        .in('status', ['pending', 'approved', 'rescheduled'])
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setNextAppointment(data as unknown as AppointmentWithDetails);
      } else {
        setNextAppointment(null);
      }
    } catch (err) {
      console.warn('Error fetching next appointment:', err);
    } finally {
      setLoadingAppt(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    fetchNextAppointment();

    // Register push token for reminders and updates
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
    }

    // Supabase Realtime Subscription: Update immediately when staff approves or reschedules
    if (!patient?.id) return;

    const channel = supabase
      .channel(`home_next_appt_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=eq.${patient.id}`,
        },
        () => {
          fetchNextAppointment();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNextAppointment, patient?.id, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await fetchNextAppointment();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('../../assets/logo.png')}
              accessibilityLabel="M-Care logo"
              resizeMode="contain"
              style={{ width: 28, height: 33, marginRight: spacing.sm }}
            />
            <View>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.patientName}>{profile?.full_name ?? 'Patient'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/notifications')}
              style={styles.iconCircle}
            >
              <Ionicons name="notifications-outline" size={typography.body.fontSize + 2} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.iconCircle}
            >
              <Ionicons name="person-outline" size={typography.body.fontSize + 2} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Shortcuts */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.primaryActionCard}
            onPress={() => router.push('/(tabs)/book')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="calendar-outline" size={28} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Book Appointment</Text>
              <Text style={styles.actionDesc}>
                Choose a service, date, and live available slots
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionCard}
            onPress={() => router.push('/(tabs)/appointments')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconBoxAlt}>
              <Ionicons name="time-outline" size={28} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitleAlt}>My Clinic Visits</Text>
              <Text style={styles.actionDescAlt}>
                Track live status, reschedule, or cancel
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionCard}
            onPress={() => router.push('/inquiry')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBoxAlt, { backgroundColor: Colors.brandSoft }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitleAlt}>Message Clinic Staff</Text>
              <Text style={styles.actionDescAlt}>
                Direct inquiries to attending clinic nurse & staff
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Next Appointment Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your Upcoming Visit</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/appointments')}>
              <Text style={styles.seeAllLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingAppt ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : nextAppointment ? (
            <View style={styles.appointmentCard}>
              <View style={styles.apptHeader}>
                <Text style={styles.apptService}>{nextAppointment.service?.name}</Text>
                <View
                  style={[
                    styles.apptBadge,
                    nextAppointment.status === 'approved'
                      ? styles.badgeApproved
                      : nextAppointment.status === 'rescheduled'
                      ? styles.badgeRescheduled
                      : styles.badgePending,
                  ]}
                >
                  <Text style={styles.apptBadgeText}>
                    {nextAppointment.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.apptDoctor}>
                Attending: {nextAppointment.doctor?.profile?.full_name ?? 'Dr. Bernice Paule'}
              </Text>
              <Text style={styles.apptRoom}>
                📍 {nextAppointment.doctor?.room ?? 'Room 201 - Consultation Suite'}
              </Text>

              <View style={styles.divider} />

              <View style={styles.apptTimeRow}>
                <Text style={styles.apptTimeLabel}>Scheduled Time:</Text>
                <Text style={styles.apptTimeValue}>
                  {formatManilaDateTime(nextAppointment.start_time)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color={Colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Upcoming Consultations</Text>
              <Text style={styles.emptyDescription}>
                You have no pending or confirmed consultations. Tap 'Book Appointment' to discover open slots.
              </Text>
            </View>
          )}
        </View>

        {/* Privacy & Health ID Card */}
        <View style={styles.patientIdCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardClinic}>M-CARE OB-GYNE CLINIC</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>DPA 2012 Verified</Text>
            </View>
          </View>
          <Text style={styles.cardRole}>Registered Patient Record</Text>
          <View style={styles.cardDetails}>
            <View>
              <Text style={styles.cardLabel}>Blood Type</Text>
              <Text style={styles.cardValue}>{patient?.blood_type ?? 'N/A'}</Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>Phone</Text>
              <Text style={styles.cardValue}>{profile?.phone ?? 'N/A'}</Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>Double-Booking Guard</Text>
              <Text style={styles.cardValue}>Active (PG Exclude)</Text>
            </View>
          </View>
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
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.small.fontSize,
    color: Colors.textSecondary,
  },
  patientName: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  signOutBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: Colors.brandSoft,
  },
  signOutText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.xl,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionGrid: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  primaryActionCard: {
    backgroundColor: Colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  actionIcon: {
    fontSize: typography.title.fontSize,
  },
  actionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.background,
  },
  actionDesc: {
    fontSize: typography.caption.fontSize,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  secondaryActionCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconBoxAlt: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  actionTitleAlt: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  actionDescAlt: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllLink: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primary,
  },
  loadingBox: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  appointmentCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  apptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  apptService: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  apptBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeApproved: {
    backgroundColor: Colors.successBackground,
  },
  badgePending: {
    backgroundColor: Colors.warningBackground,
  },
  badgeRescheduled: {
    backgroundColor: Colors.infoBackground,
  },
  apptBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  apptDoctor: {
    fontSize: typography.small.fontSize,
    color: Colors.textSecondary,
    marginBottom: spacing.xs,
  },
  apptRoom: {
    fontSize: typography.caption.fontSize,
    color: Colors.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: spacing.md,
  },
  apptTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  apptTimeLabel: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  apptTimeValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  emptyCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
  },
  emptyIcon: {
    fontSize: typography.display.fontSize,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: spacing.xs,
  },
  emptyDescription: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.caption.lineHeight,
  },
  patientIdCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardClinic: {
    fontSize: typography.caption.fontSize,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusPillText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.background,
  },
  cardRole: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.background,
    marginBottom: spacing.md,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: spacing.sm,
  },
  cardLabel: {
    fontSize: typography.caption.fontSize,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.background,
  },
});
