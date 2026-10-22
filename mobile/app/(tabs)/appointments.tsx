import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import type { AppointmentWithDetails, AppointmentStatus } from '@m-care/shared';

export default function AppointmentsScreen() {
  const router = useRouter();
  const { patient } = useAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!patient?.id) return;
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

      if (error) {
        console.error('Error fetching appointments:', error);
      } else if (data) {
        setAppointments(data as unknown as AppointmentWithDetails[]);
      }
    } catch (err) {
      console.error('Fetch appointments error:', err);
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
      `Are you sure you want to cancel your ${appt.service?.name} scheduled for ${new Date(
        appt.start_time
      ).toLocaleDateString('en-US', { dateStyle: 'medium' })}?`,
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Yes, Cancel Visit',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(appt.id);
            try {
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appt.id);

              if (error) throw error;
              fetchAppointments();
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to cancel';
              Alert.alert('Cancellation Error', message);
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
        return { bg: '#D1FAE5', text: '#065F46', label: 'Approved' };
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E', label: 'Pending Staff Review' };
      case 'rescheduled':
        return { bg: '#E0E7FF', text: '#3730A3', label: 'Rescheduled' };
      case 'completed':
        return { bg: '#E5E7EB', text: '#374151', label: 'Completed' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' };
      case 'no_show':
        return { bg: '#FED7AA', text: '#9A3412', label: 'No Show' };
      default:
        return { bg: '#F3F4F6', text: '#374151', label: status };
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
          ) : filteredAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>
                {activeTab === 'upcoming' ? '🗓️' : '📋'}
              </Text>
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
                    👨‍⚕️ {appt.doctor?.profile?.full_name ?? 'OB-GYN Specialist'}
                  </Text>
                  <Text style={styles.roomText}>
                    📍 {appt.doctor?.room ?? 'Room 201'}
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Date & Time:</Text>
                    <Text style={styles.timeValue}>
                      {new Date(appt.start_time).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
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
                          <ActivityIndicator size="small" color="#DC2626" />
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
    backgroundColor: '#FFF7F9',
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FCE7F3',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  bookCTA: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  doctorName: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  roomText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  notesBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  cardActions: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});

