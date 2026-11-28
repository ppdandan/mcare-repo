import { spacing, typography, radius, size, colors as Colors } from '@/theme';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatManilaDate, formatManilaDateTime } from '@m-care/shared';
import type { AppointmentWithDetails, AppointmentStatus } from '@m-care/shared';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, ScreenHeader, Modal, TextField } from '@/components/ui';

export default function AppointmentsScreen() {
  const router = useRouter();
  const { patient } = useAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

// Walk-in visit modal state
const [walkInModalVisible, setWalkInModalVisible] = useState(false);
const [walkInDate, setWalkInDate] = useState<Date>(new Date());
const [walkInDatePickerVisible, setWalkInDatePickerVisible] = useState(false);
const [walkInServiceId, setWalkInServiceId] = useState<string>('');
const [walkInServicePickerVisible, setWalkInServicePickerVisible] = useState(false);
const [walkInNotes, setWalkInNotes] = useState<string>('');
const [walkInConsent, setWalkInConsent] = useState(false);
const [walkInSubmitting, setWalkInSubmitting] = useState(false);
const [walkInError, setWalkInError] = useState<string | null>(null);
const [walkInSuccess, setWalkInSuccess] = useState(false);
const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
const [servicesLoading, setServicesLoading] = useState(false);

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
      setLoadError("We can't load your appointments. Check your connection and retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient?.id, activeTab]);

  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices((data ?? []) as Array<{ id: string; name: string }>);
    } catch (err) {
      console.error('Fetch services error:', err);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchServices();

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
              try {
                const { error: pushError } = await supabase.functions.invoke('dispatch-appointment-notification', {
                  body: { appointment_id: appt.id },
                });
                if (pushError) console.warn('Appointment notification push dispatch was unavailable.');
              } catch {
                console.warn('Appointment notification push dispatch was unavailable.');
              }
              await fetchAppointments();
            } catch (err: unknown) {
              console.error('Appointment cancellation failed:', err);
              Alert.alert("Cancellation failed", "We can't cancel this appointment. Refresh your visits and try again.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  // Walk-in visit handlers
  const handleWalkInDateChange = (event: any, selectedDate?: Date) => {
    setWalkInDatePickerVisible(false);
    if (selectedDate) {
      setWalkInDate(selectedDate);
    }
  };

  const handleWalkInShowDatePicker = () => {
    setWalkInDatePickerVisible(true);
    Keyboard.dismiss();
  };

  const handleWalkInSubmit = async () => {
    if (!patient?.id) {
      setWalkInError('Please log in to report a walk-in visit.');
      return;
    }

    if (!walkInServiceId) {
      setWalkInError('Please select a service.');
      return;
    }

    if (!walkInConsent) {
      setWalkInError('You must confirm you were seen without a prior booking.');
      return;
    }

    setWalkInSubmitting(true);
    setWalkInError(null);

    try {
      // The clinic schedule has one doctor. Read its database ID at submission.
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .single();
      if (doctorError || !doctorData) throw new Error('The clinic doctor is unavailable.');

      const startTime = new Date(walkInDate);
      startTime.setMinutes(startTime.getMinutes() - startTime.getTimezoneOffset());
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min duration

      const { data: appointmentData, error: rpcError } = await supabase.rpc('report_walk_in_visit', {
        p_doctor_id: doctorData.id,
        p_service_id: walkInServiceId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_notes: walkInNotes || null,
      });

      if (rpcError) throw rpcError;

      // Dispatch notification
      try {
        await supabase.functions.invoke('dispatch-appointment-notification', {
          body: { appointment_id: appointmentData },
        });
      } catch {
        console.warn('Appointment notification push dispatch was unavailable.');
      }

      setWalkInSuccess(true);
      setWalkInModalVisible(false);
      resetWalkInForm();
      await fetchAppointments();
    } catch (err: unknown) {
      console.error('Walk-in submission failed:', err);
      const message = err instanceof Error ? err.message : 'We couldn\'t submit your walk-in visit. Please try again.';
      setWalkInError(message);
    } finally {
      setWalkInSubmitting(false);
    }
  };

  const resetWalkInForm = () => {
    setWalkInDate(new Date());
    setWalkInServiceId('');
    setWalkInNotes('');
    setWalkInConsent(false);
    setWalkInError(null);
    setWalkInSuccess(false);
  };

  const handleWalkInModalClose = () => {
    if (!walkInSubmitting) {
      setWalkInModalVisible(false);
      resetWalkInForm();
    }
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
        return { tone: 'success' as const, label: 'Approved' };
      case 'pending':
        return { tone: 'warning' as const, label: 'Pending approval' };
      case 'rescheduled':
        return { tone: 'info' as const, label: 'Rescheduled' };
      case 'completed':
        return { tone: 'neutral' as const, label: 'Completed' };
      case 'cancelled':
        return { tone: 'error' as const, label: 'Cancelled' };
      case 'no_show':
        return { tone: 'warning' as const, label: 'No Show' };
      default:
        return { tone: 'neutral' as const, label: status };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        >
        {/* Header */}
        <View style={styles.header}>
          <ScreenHeader title="My visits" />
          <Button
            variant="outline"
            onPress={() => setWalkInModalVisible(true)}
            disabled={walkInSubmitting}
            loading={walkInSubmitting}
          >
            Report a walk-in visit
          </Button>

          {/* Walk-in Modal */}
          {walkInModalVisible && (
            <Modal
              visible={walkInModalVisible}
              onClose={handleWalkInModalClose}
              title="Report a Walk-in Visit"
              transparent={true}
              animationType="slide"
            >
              {/* Service selection */}
              {servicesLoading ? (
                <Text style={modalStyles.loadingText}>Loading services...</Text>
              ) : services.length === 0 ? (
                <Text style={modalStyles.loadingText}>No services available</Text>
              ) : (
                <View style={modalStyles.formGroup}>
                  <Text style={modalStyles.label}>Service</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={walkInServiceId ? `Selected service: ${services.find(s => s.id === walkInServiceId)?.name}` : 'Select service for walk-in visit'}
                    accessibilityState={{ expanded: walkInServicePickerVisible }}
                    style={[
                      modalStyles.formSelect,
                      walkInServicePickerVisible && modalStyles.formSelectFocused,
                    ]}
                    onPress={() => setWalkInServicePickerVisible(!walkInServicePickerVisible)}
                  >
                    <Text style={modalStyles.selectText}>
                      {walkInServiceId
                        ? services.find(s => s.id === walkInServiceId)?.name
                        : 'Select a service'}
                    </Text>
                  </TouchableOpacity>
                  {walkInServicePickerVisible && (
                    <View style={modalStyles.serviceOptions}>
                      {services.map((service) => (
                        <TouchableOpacity
                          key={service.id}
                          accessibilityRole="button"
                          accessibilityLabel={service.name}
                          accessibilityState={{ selected: walkInServiceId === service.id }}
                          style={modalStyles.pickerItem}
                          onPress={() => {
                            setWalkInServiceId(service.id);
                            setWalkInServicePickerVisible(false);
                          }}
                        >
                          <Text style={[
                            modalStyles.pickerItemText,
                            walkInServiceId === service.id && modalStyles.pickerItemTextSelected,
                          ]}>
                            {service.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Visit Date */}
              <View style={modalStyles.formGroup}>
                <Text style={modalStyles.label}>Visit Date</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Select visit date"
                  accessibilityValue={{ text: formatManilaDate(walkInDate) }}
                  style={[
                    modalStyles.dateInput,
                    walkInDatePickerVisible && modalStyles.dateInputFocused,
                  ]}
                  onPress={handleWalkInShowDatePicker}
                >
                  <Text style={modalStyles.dateText}>
                    {formatManilaDate(walkInDate)}
                  </Text>
                  {walkInDatePickerVisible && (
                    <DateTimePicker
                      testID="walkInDateTimePicker"
                      value={walkInDate}
                      mode="date"
                      is24Hour={true}
                      display="default"
                      onChange={(event, selectedDate) => {
                        handleWalkInDateChange(event, selectedDate);
                      }}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Notes field */}
              <View style={modalStyles.formGroup}>
                <TextField
                  label="Notes"
                  textAlignVertical="top"
                  placeholder="Enter any notes about your visit..."
                  value={walkInNotes}
                  onChangeText={(text) => setWalkInNotes(text)}
                  multiline
                  style={modalStyles.textField}
                  error={walkInError?.includes('Notes') ? walkInError : undefined}
                />
              </View>

              {/* Consent checkbox */}
              <View style={modalStyles.formGroup}>
                <Text style={modalStyles.checkboxLabel}>
                  <Text style={modalStyles.checkboxText}>
                    I was seen without prior booking
                  </Text>
                </Text>
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityLabel="Confirm walk-in visit without prior booking"
                  accessibilityState={{ checked: walkInConsent }}
                  style={[
                    modalStyles.checkboxContainer,
                    walkInConsent && modalStyles.checkboxChecked,
                  ]}
                  onPress={() => setWalkInConsent(!walkInConsent)}
                >
                  <View style={modalStyles.checkboxInner} />
                </TouchableOpacity>
              </View>

              {/* Error message */}
              {walkInError && (
                <Text style={modalStyles.errorText}>{walkInError}</Text>
              )}

              {/* Success state */}
              {walkInSuccess && (
                <View style={modalStyles.successState}>
                  <Text style={modalStyles.successText}>
                    Walk-in visit reported successfully!
                  </Text>
                  <Text style={modalStyles.successSubtext}>
                    A pending appointment has been created. The clinic will review and approve it.
                  </Text>
                </View>
              )}

              {/* Submit button */}
              {!walkInSuccess && (
                <TouchableOpacity
                  style={[
                    modalStyles.submitButton,
                    walkInSubmitting && modalStyles.submitButtonDisabled,
                  ]}
                  onPress={walkInSubmitting ? undefined : handleWalkInSubmit}
                  disabled={walkInSubmitting}
                >
                  {walkInSubmitting ? (
                    <Text style={modalStyles.submitButtonText}>Submitting...</Text>
                  ) : (
                    <Text style={modalStyles.submitButtonText}>Submit Walk-in Visit</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Close button */}
              {(!walkInSuccess || walkInError) && (
                <TouchableOpacity
                  style={modalStyles.closeButton}
                  onPress={handleWalkInModalClose}
                >
                  <Text style={modalStyles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              )}
            </Modal>
          )}

          {/* Segmented Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'upcoming' }}
              style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Text
                style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}
              >
                Upcoming
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'history' }}
              style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
              onPress={() => setActiveTab('history')}
            >
              <Text
                style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
              >
                History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

          {loading ? (
            <LoadingState label="Loading visits…" />
          ) : loadError ? (
            <ErrorState title="Appointments unavailable" message={loadError} onRetry={() => { setLoading(true); void fetchAppointments(); }} />
          ) : filteredAppointments.length === 0 ? (
            <EmptyState
              title={activeTab === 'upcoming'
                ? 'No upcoming visits'
                : 'No past visits'}
              description={activeTab === 'upcoming'
                ? 'Your pending and scheduled visits appear here.'
                : 'Past visits appear here.'}
            >
              {activeTab === 'upcoming' && (
                <Button onPress={() => router.push('/(tabs)/book')}>Book a clinic visit</Button>
              )}
            </EmptyState>
          ) : (
            filteredAppointments.map((appt) => {
              const badge = getStatusBadgeStyle(appt.status);
              const isUpcoming = ['pending', 'approved', 'rescheduled'].includes(appt.status);

              return (
                <Card key={appt.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.serviceName}>{appt.service?.name}</Text>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </View>

                  <Text style={styles.doctorName}>
                    {appt.doctor?.profile?.full_name ?? 'Doctor not recorded'}
                  </Text>
                  <Text style={styles.roomText}>
                      {appt.doctor?.room ?? 'Room not recorded'}
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Date and time</Text>
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
                      <Button
                        variant="destructive"
                        onPress={() => handleCancelAppointment(appt)}
                        loading={cancellingId === appt.id}
                        disabled={cancellingId === appt.id}
                      >
                        Cancel booking
                      </Button>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.brandWash,
  },
  header: {
    gap: spacing.md,
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
    minHeight: 48,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabButtonActive: { backgroundColor: Colors.primary },
  tabText: {
    ...typography.small,
    textAlign: 'center',
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  timeRow: { gap: spacing.xs },
  timeLabel: { ...typography.small, color: Colors.textSecondary },
  timeValue: { ...typography.body, fontWeight: '600', color: Colors.text },
  notesBox: { marginTop: spacing.sm },
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

// Walk-in modal styles
const modalStyles = StyleSheet.create({
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: spacing.xs,
  },
  formSelect: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
  },
  formSelectFocused: {
    borderColor: Colors.primary,
  },
  selectText: {
    ...typography.body,
    color: Colors.text,
  },
  serviceOptions: {
    marginTop: spacing.xs,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    minHeight: 48,
  },
  pickerItemText: {
    ...typography.body,
    color: Colors.text,
  },
  pickerItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  dateInput: {
    minHeight: size.tapTarget,
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateInputFocused: {
    borderColor: Colors.primary,
  },
  dateText: {
    ...typography.body,
    color: Colors.text,
  },
  textField: { minHeight: 64 },
  checkboxLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  checkboxText: {
    marginLeft: spacing.sm,
    fontSize: typography.caption.fontSize,
    color: Colors.text,
  },
  checkboxContainer: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    backgroundColor: Colors.background,
    borderRadius: radius.sm,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: Colors.error,
    marginBottom: spacing.md,
  },
  successState: {
    padding: spacing.lg,
    textAlign: 'center',
  },
  successText: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: spacing.sm,
  },
  successSubtext: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.primaryDark,
  },
  submitButtonText: {
    color: Colors.background,
    fontSize: typography.small.fontSize,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: size.tapTarget,
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  closeButtonText: {
    color: Colors.textSecondary,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});

