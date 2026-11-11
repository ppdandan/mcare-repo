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
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import Colors from '@/constants/Colors';
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
              source={require('../assets/logo.png')}
              accessibilityLabel="M-Care logo"
              resizeMode="contain"
              style={{ width: 28, height: 33, marginRight: 8 }}
            />
            <View>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.patientName}>{profile?.full_name ?? 'Patient'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/notifications')}
              style={styles.iconCircle}
            >
              <Text style={{ fontSize: 16 }}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.iconCircle}
            >
              <Text style={{ fontSize: 16 }}>👤</Text>
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
              <Text style={styles.actionIcon}>📅</Text>
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
              <Text style={styles.actionIcon}>📋</Text>
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
            <View style={[styles.actionIconBoxAlt, { backgroundColor: '#EDE9FE' }]}>
              <Text style={styles.actionIcon}>💬</Text>
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
              <Text style={styles.emptyIcon}>🗓️</Text>
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
    backgroundColor: '#FFF7F9',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  signOutBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FCE7F3',
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionGrid: {
    marginBottom: 20,
    gap: 12,
  },
  primaryActionCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  secondaryActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIconBoxAlt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FDE7F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionTitleAlt: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  actionDescAlt: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  apptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apptService: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  apptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeApproved: {
    backgroundColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeRescheduled: {
    backgroundColor: '#E0E7FF',
  },
  apptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  apptDoctor: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  apptRoom: {
    fontSize: 12,
    color: Colors.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  apptTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  apptTimeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  apptTimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  patientIdCard: {
    backgroundColor: '#BE185D',
    borderRadius: 20,
    padding: 18,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardClinic: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardRole: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: 10,
  },
  cardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
