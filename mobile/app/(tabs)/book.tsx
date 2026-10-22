import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import type { Service, DoctorWithProfile, AvailableSlot } from '@m-care/shared';

export default function BookScreen() {
  const router = useRouter();
  const { patient } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Data collections
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<DoctorWithProfile[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);

  // Selection states
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorWithProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch services and doctors on mount
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      try {
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (servicesData) setServices(servicesData as Service[]);

        const { data: doctorsData } = await supabase
          .from('doctors')
          .select(`
            *,
            profile:profiles (*)
          `)
          .order('specialty');
        if (doctorsData) setDoctors(doctorsData as unknown as DoctorWithProfile[]);
      } catch (err) {
        console.error('Error loading services/doctors:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // When Doctor and Date are selected, query available slots via RPC
  useEffect(() => {
    async function fetchSlots() {
      if (!selectedDoctor || !selectedDate || !selectedService) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const { data, error } = await supabase.rpc('get_available_slots', {
          p_doctor_id: selectedDoctor.id,
          p_target_date: selectedDate,
          p_slot_duration_minutes: selectedService.duration_minutes || 30,
        });

        if (error) {
          console.error('RPC Error fetching slots:', error);
          setSlots([]);
        } else {
          setSlots((data as AvailableSlot[]) || []);
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    if (step === 4) {
      fetchSlots();
    }
  }, [step, selectedDoctor, selectedDate, selectedService]);

  // Generate next 14 calendar dates
  const nextDates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1); // Start from tomorrow
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { dateStr, dayLabel, monthLabel };
  });

  const handleConfirmBooking = async () => {
    if (!patient?.id || !selectedDoctor || !selectedService || !selectedSlot) {
      Alert.alert('Incomplete Details', 'Please complete all booking steps.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        patient_id: patient.id,
        doctor_id: selectedDoctor.id,
        service_id: selectedService.id,
        start_time: selectedSlot.slot_start,
        end_time: selectedSlot.slot_end,
        status: 'pending',
        notes: notes.trim() || null,
      });

      if (error) {
        // Check for exclusion constraint violation (PostgreSQL code 23P01)
        if (error.code === '23P01' || error.message.includes('no_doctor_double_booking')) {
          Alert.alert(
            'Slot No Longer Available',
            'Another patient has just secured this time slot. Please select a different time or date.'
          );
          setStep(4);
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
              setSelectedDoctor(null);
              setSelectedDate('');
              setSelectedSlot(null);
              setNotes('');
              router.replace('/(tabs)/appointments');
            },
          },
        ]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not complete booking.';
      Alert.alert('Booking Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Step Indicator */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Clinic Visit</Text>
          <Text style={styles.stepSubtitle}>Step {step} of 5</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 5) * 100}%` }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading clinic directory...</Text>
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
                  {services.map((svc) => (
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

              {/* STEP 2: SELECT DOCTOR */}
              {step === 2 && (
                <View>
                  <Text style={styles.sectionHeading}>Select Specialist</Text>
                  <Text style={styles.sectionSub}>
                    Choose an attending OB-GYN physician for {selectedService?.name}.
                  </Text>
                  {doctors.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={[
                        styles.card,
                        selectedDoctor?.id === doc.id && styles.cardActive,
                      ]}
                      onPress={() => setSelectedDoctor(doc)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.doctorHeader}>
                        <View style={styles.doctorAvatar}>
                          <Text style={styles.doctorAvatarText}>
                            {doc.profile.full_name.charAt(4) || 'D'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{doc.profile.full_name}</Text>
                          <Text style={styles.docSpecialty}>{doc.specialty}</Text>
                          <Text style={styles.docRoom}>📍 {doc.room ?? 'Consultation Suite'}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* STEP 3: SELECT DATE */}
              {step === 3 && (
                <View>
                  <Text style={styles.sectionHeading}>Choose Appointment Date</Text>
                  <Text style={styles.sectionSub}>
                    Available clinic days for {selectedDoctor?.profile.full_name}:
                  </Text>
                  <View style={styles.dateGrid}>
                    {nextDates.map((d) => (
                      <TouchableOpacity
                        key={d.dateStr}
                        style={[
                          styles.dateCard,
                          selectedDate === d.dateStr && styles.dateCardActive,
                        ]}
                        onPress={() => setSelectedDate(d.dateStr)}
                      >
                        <Text
                          style={[
                            styles.dateDay,
                            selectedDate === d.dateStr && styles.textActive,
                          ]}
                        >
                          {d.dayLabel}
                        </Text>
                        <Text
                          style={[
                            styles.dateMonth,
                            selectedDate === d.dateStr && styles.textActive,
                          ]}
                        >
                          {d.monthLabel}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* STEP 4: SELECT AVAILABLE TIME SLOT */}
              {step === 4 && (
                <View>
                  <Text style={styles.sectionHeading}>Available Time Slots</Text>
                  <Text style={styles.sectionSub}>
                    Date: {new Date(selectedDate).toLocaleDateString('en-US', { dateStyle: 'full' })}
                    {'\n'}
                    Physician: {selectedDoctor?.profile.full_name}
                  </Text>

                  {loadingSlots ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={styles.loadingText}>Calculating free clinic slots...</Text>
                    </View>
                  ) : slots.length === 0 ? (
                    <View style={styles.noSlotsBox}>
                      <Text style={styles.noSlotsIcon}>⏳</Text>
                      <Text style={styles.noSlotsTitle}>No Available Slots</Text>
                      <Text style={styles.noSlotsDesc}>
                        The doctor is either fully booked or not in the clinic on this day.
                        Please select another date.
                      </Text>
                      <TouchableOpacity
                        style={styles.backStepButton}
                        onPress={() => setStep(3)}
                      >
                        <Text style={styles.backStepText}>Choose Another Date</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.slotsGrid}>
                      {slots.map((slot, index) => {
                        const isSelected =
                          selectedSlot?.slot_start === slot.slot_start;
                        return (
                          <TouchableOpacity
                            key={index}
                            style={[styles.slotChip, isSelected && styles.slotChipActive]}
                            onPress={() => setSelectedSlot(slot)}
                          >
                            <Text
                              style={[
                                styles.slotTime,
                                isSelected && styles.slotTimeActive,
                              ]}
                            >
                              {formatSlotTime(slot.slot_start)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* STEP 5: REVIEW & CONFIRM */}
              {step === 5 && (
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
                        {new Date(selectedDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
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
              onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
              disabled={submitting}
            >
              <Text style={styles.prevButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 5 ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                ((step === 1 && !selectedService) ||
                  (step === 2 && !selectedDoctor) ||
                  (step === 3 && !selectedDate) ||
                  (step === 4 && !selectedSlot)) &&
                  styles.buttonDisabled,
              ]}
              disabled={
                (step === 1 && !selectedService) ||
                (step === 2 && !selectedDoctor) ||
                (step === 3 && !selectedDate) ||
                (step === 4 && !selectedSlot)
              }
              onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)}
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
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  slotTimeActive: {
    color: '#FFFFFF',
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

