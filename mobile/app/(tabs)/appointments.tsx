import { spacing, typography, radius } from '@/theme';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors as Colors } from '@/theme';
import { formatManilaDate, formatManilaDateTime } from '@m-care/shared';
import type { AppointmentWithDetails, AppointmentStatus } from '@m-care/shared';

export default function AppointmentsScreen() {
  const router = useRouter();
  const { patient } = useAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!patient?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(null);
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
        .order('start_time', { ascending: activeTab === 'upcoming' });

      if (error) throw error;
      setAppointments((data ?? []) as unknown as AppointmentWithDetails[]);
    } catch (err) {
      console.error('Fetch appointments error:', err);
      setLoadError('We couldn’t load your appointments. Check your connection and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient?.id, activeTab]);

  useEffect(() => {
    fetchAppointments();

    // Supabase Realtime Subscription: Update immediately when staff approves/reschedules
    if (!patient?.id) return;

    const channel = supabase
      .channel(`patient_appointments_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=eq.${patient.id}`,
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments, patient?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const handleCancelAppointment = (appt: AppointmentWithDetails) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel your ${appt.service?.name} scheduled for ${formatManilaDate(appt.start_time)}?`,
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Yes, Cancel Visit',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(appt.id);
            try {
              const { error } = await supabase.rpc('cancel_my_appointment', {
                p_appointment_id: appt.id,
              });

              if (error) throw error;
              await fetchAppointments();
            } catch (err: unknown) {
              console.error('Appointment cancellation failed:', err);
              Alert.alert('Cancellation failed', 'We couldn’t cancel this appointment. Refresh your visits and try again.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  // Filter based on active tab
  const filteredAppointments = appointments.filter((a) => {
    if (activeTab === 'upcoming') {
      return ['pending', 'approved', 'rescheduled'].includes(a.status);
    }
    return ['completed', 'cancelled', 'no_show'].includes(a.status);
  });

  const getStatusBadgeStyle = (status: AppointmentStatus) => {
    switch (status) {
      case 'approved':
        return { bg: Colors.successBackground, text: Colors.success, label: 'Approved' };
      case 'pending':
        return { bg: Colors.warningBackground, text: Colors.warning, label: 'Pending Staff Review' };
      case 'rescheduled':
        return { bg: Colors.infoBackground, text: Colors.info, label: 'Rescheduled' };
      case 'completed':
        return { bg: Colors.border, text: Colors.text, label: 'Completed' };
      case 'cancelled':
        return { bg: Colors.errorBackground, text: Colors.error, label: 'Cancelled' };
      case 'no_show':
        return { bg: Colors.warningBackground, text: Colors.warning, label: 'No Show' };
      default:
        return { bg: Colors.surfaceAlt, text: Colors.text, label: status };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Clinic Visits</Text>
          <Text style={styles.headerSubtitle}>
            Live appointment tracking & consultation history
          </Text>

          {/* Segmented Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Text
                style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}
              >
                Upcoming & Active
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
              onPress={() => setActiveTab('history')}
            >
              <Text
                style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
              >
                Visit History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Syncing appointments with clinic...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Appointments unavailable</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity style={styles.bookCTA} onPress={() => { setLoading(true); void fetchAppointments(); }}>
                <Text style={styles.bookCTAText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} size={40} color={Colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming'
                  ? 'No Upcoming Appointments'
                  : 'No Past Appointments Found'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming'
                  ? 'You currently have no active or pending appointments booked with M-Care Clinic.'
                  : 'Your completed or archived clinic consultations will be listed here.'}
              </Text>

              {activeTab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.bookCTA}
                  onPress={() => router.push('/(tabs)/book')}
                >
                  <Text style={styles.bookCTAText}>Book an Appointment Now</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredAppointments.map((appt) => {
              const badge = getStatusBadgeStyle(appt.status);
              const isUpcoming = ['pending', 'approved', 'rescheduled'].includes(appt.status);

              return (
                <View key={appt.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.serviceName}>{appt.service?.name}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.doctorName}>
                    {appt.doctor?.profile?.full_name ?? 'Dr. Bernice Paule'}
                  </Text>
                  <Text style={styles.roomText}>
                    📍 {appt.doctor?.room ?? 'Room 201'}
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Date & Time:</Text>
                    <Text style={styles.timeValue}>
                      {formatManilaDateTime(appt.start_time, {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  {appt.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.notesText}>{appt.notes}</Text>
                    </View>
                  )}

                  {isUpcoming && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancelAppointment(appt)}
                        disabled={cancellingId === appt.id}
                      >
                        {cancellingId === appt.id ? (
                          <ActivityIndicator size="small" color={Colors.error} />
                        ) : (
                          <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
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
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandSoft,
  },
  headerTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabButtonActive: {
    backgroundColor: Colors.background,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  centerBox: {
    padding: spacing['4xl'],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.xl,
    padding: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  emptyIcon: {
    fontSize: typography.largeTitle.fontSize,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.caption.lineHeight,
    marginBottom: spacing.xl,
  },
  bookCTA: {
    backgroundColor: Colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  bookCTAText: {
    color: Colors.background,
    fontSize: typography.small.fontSize,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  serviceName: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  doctorName: {
    fontSize: typography.small.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  roomText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textLight,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceAlt,
    marginVertical: spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  timeValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  notesBox: {
    backgroundColor: Colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  notesLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.caption.fontSize,
    color: Colors.text,
    lineHeight: typography.caption.lineHeight,
  },
  cardActions: {
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceAlt,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: Colors.errorBackground,
    backgroundColor: Colors.errorBackground,
  },
  cancelBtnText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.error,
  },
});

