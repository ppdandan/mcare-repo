import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { fetchWithCache } from '@/lib/cache';
import {
  formatManilaDate,
  formatManilaTime,
  manilaDateKey,
  manilaDateTimeIso,
  weekdayForDateKey,
} from '@m-care/shared';
import type { Service, DoctorWithProfile, AvailableSlot, DoctorSchedule } from '@m-care/shared';

type BookingSlot = AvailableSlot & { available: boolean };

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return error instanceof Error ? error.message : fallback;
}

export default function BookScreen() {
  const router = useRouter();
  const { patient } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Data collections
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<BookingSlot[]>([]);

  // Selection states
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [slotRetry, setSlotRetry] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [year, month] = manilaDateKey().split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1, 12));
  });

  // Fetch services and doctors on mount (cached for fast repeated loads)
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError(null);
    try {
      const servicesData = await fetchWithCache('clinic_services_active', async () => {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return (data as Service[]) || [];
      }, 15 * 60 * 1000);
      setServices(servicesData || []);

      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select(`*, profile:profiles (*)`)
        .eq('profile.full_name', 'Dr. Bernice Paule')
        .eq('specialty', 'OB-GYNE / Sonologist')
        .maybeSingle();
      if (doctorError) throw doctorError;
      if (!doctorData) throw new Error('Dr. Bernice Paule is not available for booking. Please try again later.');
      setSelectedDoctor(doctorData as unknown as DoctorWithProfile);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not load clinic services.');
      console.error('Error loading booking catalog:', err);
      setCatalogError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // When Doctor and Date are selected, query available slots via RPC
  useEffect(() => {
    async function fetchSlots() {
      if (!selectedDoctor || !selectedDate || !selectedService) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        setSlotError(null);
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_doctor_id: selectedDoctor.id,
          p_target_date: selectedDate,
          p_slot_duration_minutes: selectedService.duration_minutes || 30,
        });

        if (error) throw error;

        const { data: schedules, error: scheduleError } = await supabase
          .from('doctor_schedules')
          .select('*')
          .eq('doctor_id', selectedDoctor.id)
          .eq('weekday', weekdayForDateKey(selectedDate))
          .order('start_time');
        if (scheduleError) throw scheduleError;

        const freeStarts = new Set(
          ((data as AvailableSlot[]) || []).map((slot) => new Date(slot.slot_start).getTime())
        );
        const duration = selectedService.duration_minutes || 30;
        const candidates: BookingSlot[] = [];
        (schedules as DoctorSchedule[]).forEach((schedule) => {
          const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
          const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
          const rangeStart = startHour * 60 + startMinute;
          const rangeEnd = endHour * 60 + endMinute;
          for (let minute = rangeStart; minute + duration <= rangeEnd; minute += duration) {
            const hour = Math.floor(minute / 60);
            const minuteOfHour = minute % 60;
            const time = `${String(hour).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}:00`;
            const slotStart = manilaDateTimeIso(selectedDate, time);
            const slotEnd = manilaDateTimeIso(
              selectedDate,
              `${String(Math.floor((minute + duration) / 60)).padStart(2, '0')}:${String((minute + duration) % 60).padStart(2, '0')}:00`
            );
            candidates.push({
              slot_start: slotStart,
              slot_end: slotEnd,
              available: freeStarts.has(new Date(slotStart).getTime()),
            });
          }
        });
        setSlots(candidates);
      } catch (err) {
        const message = getErrorMessage(err, 'Could not load appointment slots.');
        console.error('Error fetching slots:', err);
        setSlotError(message);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    if (step === 3) {
      fetchSlots();
    }
  }, [step, selectedDoctor, selectedDate, selectedService, slotRetry]);

  const today = manilaDateKey();
  const monthYear = visibleMonth.getUTCFullYear();
  const monthIndex = visibleMonth.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(monthYear, monthIndex, 1, 12)).getUTCDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(Date.UTC(monthYear, monthIndex, 1 - firstWeekday + index, 12));
    const dateStr = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    return {
      dateStr,
      dayNumber: day.getUTCDate(),
      inMonth: day.getUTCMonth() === monthIndex,
      isWeekend: weekday === 0 || weekday === 6,
      isPast: dateStr < today,
    };
  });
  const monthStart = `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;

  const handleConfirmBooking = async () => {
    if (!patient?.id || !selectedDoctor || !selectedService || !selectedSlot) {
      Alert.alert('Incomplete Details', 'Please complete all booking steps.');
      return;
    }

    setSubmitting(true);
    setBookingError(null);
    try {
      const { error } = await supabase.rpc('book_appointment', {
        p_doctor_id: selectedDoctor.id,
        p_service_id: selectedService.id,
        p_start_time: selectedSlot.slot_start,
        p_notes: notes.trim() || null,
      });

      if (error) {
        // Check for exclusion constraint violation (PostgreSQL code 23P01)
        if (error.code === '23P01' || error.message.includes('no_doctor_double_booking')) {
          setBookingError(error.message);
          setStep(3);
          setSlotRetry((count) => count + 1);
          return;
        }
        throw error;
      }

      Alert.alert(
        'Booking Request Submitted! 🎉',
        'Your appointment request has been scheduled. Clinic staff will verify and confirm your slot shortly.',
        [
          {
            text: 'View My Visits',
            onPress: () => {
              // Reset booking wizard and navigate to appointments
              setStep(1);
              setSelectedService(null);
              setSelectedDate('');
              setSelectedSlot(null);
              setNotes('');
              setBookingError(null);
              router.replace('/(tabs)/appointments');
            },
          },
        ]
      );
    } catch (err: unknown) {
      setBookingError(getErrorMessage(err, 'Could not complete booking.'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotTime = (isoString: string) => {
    return formatManilaTime(isoString);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Step Indicator */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Clinic Visit</Text>
              <Text style={styles.stepSubtitle}>Step {step} of 4</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading clinic directory...</Text>
            </View>
          ) : catalogError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Could not load booking details</Text>
              <Text style={styles.errorMessage}>{catalogError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadCatalog}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* STEP 1: SELECT SERVICE */}
              {step === 1 && (
                <View>
                  <Text style={styles.sectionHeading}>Select Clinic Service</Text>
                  <Text style={styles.sectionSub}>
                    Choose the medical procedure or consultation you require.
                  </Text>
                  {services.length === 0 ? (
                    <View style={styles.noSlotsBox}>
                      <Text style={styles.noSlotsTitle}>No services are available</Text>
                      <Text style={styles.noSlotsDesc}>Please retry or contact the clinic.</Text>
                      <TouchableOpacity style={styles.retryButton} onPress={loadCatalog}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : services.map((svc) => (
                    <TouchableOpacity
                      key={svc.id}
                      style={[
                        styles.card,
                        selectedService?.id === svc.id && styles.cardActive,
                      ]}
                      onPress={() => setSelectedService(svc)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.serviceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{svc.name}</Text>
                          <Text style={styles.cardDescription}>{svc.description}</Text>
                        </View>
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{svc.duration_minutes} min</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* STEP 2: SELECT DATE; Dr. Bernice Paule is assigned automatically. */}
              {step === 2 && (
                <View>
                  <Text style={styles.sectionHeading}>Choose Appointment Date</Text>
                  <Text style={styles.sectionSub}>
                    {selectedService?.name} · {selectedDoctor?.profile.full_name} · {selectedDoctor?.specialty}
                    {'\n'}Available at {selectedDoctor?.room ?? 'Consultation Room'}
                  </Text>
                  <View style={styles.calendarHeader}>
                    <TouchableOpacity
                      accessibilityLabel="Previous month"
                      style={styles.monthButton}
                      onPress={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1, 12)))}
                    >
                      <Text style={styles.monthButtonText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>{formatManilaDate(monthStart, { month: 'long', year: 'numeric' })}</Text>
                    <TouchableOpacity
                      accessibilityLabel="Next month"
                      style={styles.monthButton}
                      onPress={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1, 12)))}
                    >
                      <Text style={styles.monthButtonText}>›</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.weekdayRow}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Text key={day} style={styles.weekdayLabel}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {calendarDays.map((day) => {
                      const disabled = !day.inMonth || day.isPast || day.isWeekend;
                      const active = selectedDate === day.dateStr;
                      return (
                        <TouchableOpacity
                          key={day.dateStr}
                          accessibilityRole="button"
                          accessibilityState={{ disabled, selected: active }}
                          disabled={disabled}
                          style={[
                            styles.calendarDay,
                            disabled && styles.calendarDayDisabled,
                            active && styles.calendarDayActive,
                          ]}
                          onPress={() => {
                            setSelectedDate(day.dateStr);
                            setSelectedSlot(null);
                            setBookingError(null);
                          }}
                        >
                          <Text style={[styles.calendarDayText, disabled && styles.calendarDayTextDisabled, active && styles.calendarDayTextActive]}>
                            {day.dayNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* STEP 3: SELECT AVAILABLE TIME SLOT */}
              {step === 3 && (
                <View>
                  <Text style={styles.sectionHeading}>Available Time Slots</Text>
                  <Text style={styles.sectionSub}>
                    Date: {formatManilaDate(selectedDate, { dateStyle: 'full' })}
                    {'\n'}
                    Physician: {selectedDoctor?.profile.full_name}
                  </Text>

                  {bookingError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>That time is no longer available</Text>
                      <Text style={styles.errorMessage}>{bookingError}</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                          setBookingError(null);
                          setSlotRetry((count) => count + 1);
                        }}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {slotError ? (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>Could not load time slots</Text>
                      <Text style={styles.errorMessage}>{slotError}</Text>
                      <TouchableOpacity style={styles.retryButton} onPress={() => setSlotRetry((count) => count + 1)}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : loadingSlots ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={styles.loadingText}>Calculating free clinic slots...</Text>
                    </View>
                  ) : slots.length === 0 ? (
                    <View style={styles.noSlotsBox}>
                      <Text style={styles.noSlotsIcon}>⏳</Text>
                      <Text style={styles.noSlotsTitle}>No Clinic Hours</Text>
                      <Text style={styles.noSlotsDesc}>
                        No appointment hours are scheduled for this weekday. Please select another date.
                      </Text>
                      <TouchableOpacity
                        style={styles.backStepButton}
                        onPress={() => setStep(2)}
                      >
                        <Text style={styles.backStepText}>Choose Another Date</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.slotsGrid}>
                      {slots.map((slot, index) => {
                        const isSelected = selectedSlot?.slot_start === slot.slot_start;
                        return (
                          <TouchableOpacity
                            key={slot.slot_start || index}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !slot.available, selected: isSelected }}
                            disabled={!slot.available}
                            style={[styles.slotChip, !slot.available && styles.slotChipDisabled, isSelected && styles.slotChipActive]}
                            onPress={() => {
                              setSelectedSlot(slot);
                              setBookingError(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.slotTime,
                                !slot.available && styles.slotTimeDisabled,
                                isSelected && styles.slotTimeActive,
                              ]}
                            >
                              {formatSlotTime(slot.slot_start)}
                            </Text>
                            {!slot.available && <Text style={styles.slotUnavailable}>Unavailable</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* STEP 4: REVIEW & CONFIRM */}
              {step === 4 && (
                <View>
                  <Text style={styles.sectionHeading}>Review & Confirm Visit</Text>
                  <Text style={styles.sectionSub}>
                    Please review your booking details before submission.
                  </Text>

                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Patient</Text>
                      <Text style={styles.summaryValue}>{patient?.profile_id ? 'Your Profile' : 'Patient'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Service</Text>
                      <Text style={styles.summaryValue}>{selectedService?.name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Attending Doctor</Text>
                      <Text style={styles.summaryValue}>{selectedDoctor?.profile.full_name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Room / Clinic</Text>
                      <Text style={styles.summaryValue}>{selectedDoctor?.room}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Date</Text>
                      <Text style={styles.summaryValue}>
                        {formatManilaDate(selectedDate)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Time</Text>
                      <Text style={[styles.summaryValue, { color: Colors.primaryDark, fontWeight: '700' }]}>
                        {selectedSlot ? formatSlotTime(selectedSlot.slot_start) : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.notesGroup}>
                    <Text style={styles.notesLabel}>Notes or Symptoms (Optional):</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="e.g. 24 weeks checkup, experiencing mild back pain, routine ultrasound"
                      placeholderTextColor={Colors.textLight}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {bookingError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>Booking failed</Text>
                      <Text style={styles.errorMessage}>{bookingError}</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        disabled={submitting}
                        onPress={handleConfirmBooking}
                      >
                        <Text style={styles.retryButtonText}>{submitting ? 'Retrying…' : 'Retry'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.exclusionNote}>
                    <Text style={styles.exclusionText}>
                      🔒 Protected by PostgreSQL double-booking prevention. Once submitted, your slot is locked in real-time.
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Bottom Navigation Buttons */}
        <View style={styles.bottomBar}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              disabled={submitting}
            >
              <Text style={styles.prevButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                ((step === 1 && !selectedService) ||
                  (step === 2 && (!selectedDate || !selectedDoctor)) ||
                  (step === 3 && !selectedSlot)) &&
                  styles.buttonDisabled,
              ]}
              disabled={
                (step === 1 && !selectedService) ||
                (step === 2 && (!selectedDate || !selectedDoctor)) ||
                (step === 3 && !selectedSlot)
              }
              onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.confirmButton, submitting && styles.buttonDisabled]}
              onPress={handleConfirmBooking}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm & Book</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
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
    display: 'flex',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FCE7F3',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  stepSubtitle: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#FCE7F3',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 30,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0F5',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  durationBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  doctorAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  docSpecialty: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  docRoom: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFF0F5',
  },
  monthButtonText: {
    color: Colors.primaryDark,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  monthTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  weekdayLabel: {
    width: '13.5%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
  },
  calendarDay: {
    width: '13.5%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  calendarDayDisabled: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
  },
  calendarDayActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  calendarDayText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  calendarDayTextDisabled: {
    color: '#9CA3AF',
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  dateCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  dateDay: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dateMonth: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  textActive: {
    color: '#FFFFFF',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotChip: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  slotChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  slotChipDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#E5E7EB',
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  slotTimeActive: {
    color: '#FFFFFF',
  },
  slotTimeDisabled: {
    color: '#6B7280',
  },
  slotUnavailable: {
    marginTop: 2,
    fontSize: 9,
    color: '#6B7280',
  },
  errorBox: {
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
  },
  errorTitle: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 14,
  },
  errorMessage: {
    color: '#7F1D1D',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noSlotsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 10,
  },
  noSlotsIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noSlotsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  noSlotsDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  backStepButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FDE7F3',
  },
  backStepText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  notesGroup: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    height: 70,
    textAlignVertical: 'top',
  },
  exclusionNote: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  exclusionText: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#FCE7F3',
    gap: 12,
  },
  prevButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  nextButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

