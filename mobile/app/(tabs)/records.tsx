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
  Modal,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import type { MedicalRecordWithDetails } from '@m-care/shared';

export default function RecordsScreen() {
  const { patient } = useAuth();
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordWithDetails | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!patient?.id) return;
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select(`
          *,
          doctor:doctors (
            *,
            profile:profiles (*)
          ),
          patient:patients (
            *,
            profile:profiles (*)
          )
        `)
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false });

      if (error) {
        console.error('Error fetching medical records:', error);
      } else if (data) {
        setRecords(data as unknown as MedicalRecordWithDetails[]);
      }
    } catch (err) {
      console.error('Fetch records error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  const handleOpenDetail = async (record: MedicalRecordWithDetails) => {
    setSelectedRecord(record);

    // DPA 2012 Compliance: Log every view of sensitive medical records in audit_logs
    try {
      await supabase.rpc('log_medical_record_access', {
        p_record_id: record.id,
        p_action: 'VIEW',
      });
    } catch (err) {
      console.warn('Audit log note:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medical History & Records</Text>
          <Text style={styles.headerSubtitle}>
            Read-only clinical charts, laboratory findings, and prescriptions
          </Text>

          {/* DPA Banner */}
          <View style={styles.dpaBanner}>
            <Text style={styles.dpaBannerText}>
              🔒 Protected Health Information • Philippine Data Privacy Act of 2012
            </Text>
          </View>
        </View>

        {/* Content */}
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
              <Text style={styles.loadingText}>Loading confidential records...</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🩺</Text>
              <Text style={styles.emptyTitle}>No Medical Records Yet</Text>
              <Text style={styles.emptyText}>
                Your doctor will upload your clinical notes, diagnoses, and prescriptions
                following your completed clinic consultations.
              </Text>
            </View>
          ) : (
            records.map((rec) => (
              <TouchableOpacity
                key={rec.id}
                style={styles.card}
                onPress={() => handleOpenDetail(rec)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.visitDate}>
                    {new Date(rec.visit_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Verified Chart</Text>
                  </View>
                </View>

                <Text style={styles.doctorName}>
                  Attending: {rec.doctor?.profile?.full_name ?? 'Physician'}
                </Text>

                <View style={styles.divider} />

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Chief Complaint:</Text>
                  <Text style={styles.fieldVal} numberOfLines={2}>
                    {rec.chief_complaint || 'Routine consultation'}
                  </Text>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Diagnosis:</Text>
                  <Text style={[styles.fieldVal, styles.diagnosisText]} numberOfLines={2}>
                    {rec.diagnosis || 'Clinical evaluation ongoing'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailText}>Tap to view prescription & vitals →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Confidential Detail Modal */}
        {selectedRecord && (
          <Modal
            visible={!!selectedRecord}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setSelectedRecord(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <div>
                    <Text style={styles.modalTitle}>Consultation Record</Text>
                    <Text style={styles.modalSub}>
                      {new Date(selectedRecord.visit_date).toLocaleDateString('en-US', {
                        dateStyle: 'full',
                      })}
                    </Text>
                  </div>
                  <TouchableOpacity
                    onPress={() => setSelectedRecord(null)}
                    style={styles.closeBtn}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  {/* Attending Doctor */}
                  <View style={styles.detailSection}>
                    <Text style={styles.secTitle}>Attending OB-GYN Physician</Text>
                    <Text style={styles.secValue}>
                      {selectedRecord.doctor?.profile?.full_name}
                    </Text>
                    <Text style={styles.secSub}>{selectedRecord.doctor?.specialty}</Text>
                  </View>

                  {/* Vitals */}
                  <View style={styles.detailSection}>
                    <Text style={styles.secTitle}>Recorded Patient Vitals (Triage)</Text>
                    <View style={styles.vitalsGrid}>
                      <View style={styles.vitalBox}>
                        <Text style={styles.vitalLabel}>Blood Pressure</Text>
                        <Text style={styles.vitalVal}>
                          {selectedRecord.blood_pressure || '—'}
                        </Text>
                      </View>
                      <View style={styles.vitalBox}>
                        <Text style={styles.vitalLabel}>Heart Rate</Text>
                        <Text style={styles.vitalVal}>
                          {selectedRecord.heart_rate || '—'}
                        </Text>
                      </View>
                      <View style={styles.vitalBox}>
                        <Text style={styles.vitalLabel}>Temperature</Text>
                        <Text style={styles.vitalVal}>
                          {selectedRecord.temperature || '—'}
                        </Text>
                      </View>
                      <View style={styles.vitalBox}>
                        <Text style={styles.vitalLabel}>Weight</Text>
                        <Text style={styles.vitalVal}>
                          {selectedRecord.weight_kg ? `${selectedRecord.weight_kg} kg` : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chief Complaint & History */}
                  <View style={styles.detailSection}>
                    <Text style={styles.secTitle}>Chief Complaint & Symptoms</Text>
                    <Text style={styles.secValueText}>
                      {selectedRecord.chief_complaint || 'None recorded'}
                    </Text>

                    {selectedRecord.history_of_present_illness && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.secTitle}>History of Present Illness</Text>
                        <Text style={styles.secValueText}>
                          {selectedRecord.history_of_present_illness}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Diagnosis */}
                  <View style={[styles.detailSection, styles.highlightSection]}>
                    <Text style={[styles.secTitle, { color: Colors.primaryDark }]}>
                      Clinical Diagnosis & Impression
                    </Text>
                    <Text style={styles.diagnosisLarge}>
                      {selectedRecord.diagnosis || 'Diagnosis pending laboratory results'}
                    </Text>
                  </View>

                  {/* Prescription */}
                  <View style={[styles.detailSection, styles.prescriptionSection]}>
                    <Text style={[styles.secTitle, { color: '#065F46' }]}>
                      Rx — Official Medical Prescription
                    </Text>
                    <Text style={styles.prescriptionText}>
                      {selectedRecord.prescription || 'No medications prescribed for this visit.'}
                    </Text>
                  </View>

                  {/* Clinical Notes */}
                  {selectedRecord.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.secTitle}>Doctor's Follow-up Instructions</Text>
                      <Text style={styles.secValueText}>{selectedRecord.notes}</Text>
                    </View>
                  )}

                  <View style={styles.auditStamp}>
                    <Text style={styles.auditStampText}>
                      Audited under RA 10173 • Access timestamp logged to audit_logs
                    </Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
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
    marginBottom: 10,
  },
  dpaBanner: {
    backgroundColor: '#FDF2F8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  dpaBannerText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
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
    marginTop: 20,
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitDate: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3730A3',
  },
  doctorName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  fieldRow: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  fieldVal: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
    marginTop: 1,
  },
  diagnosisText: {
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalBody: {
    marginTop: 14,
  },
  detailSection: {
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
  },
  highlightSection: {
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  prescriptionSection: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  secTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  secValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  secSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  secValueText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  vitalBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vitalLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  vitalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  diagnosisLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
    lineHeight: 20,
  },
  prescriptionText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  auditStamp: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  auditStampText: {
    fontSize: 10,
    color: Colors.textLight,
  },
});
