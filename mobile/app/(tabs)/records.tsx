import { spacing, typography, radius } from '@m-care/shared';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { formatManilaDate } from '@m-care/shared';
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
              <Ionicons name="document-text-outline" size={40} color={Colors.primary} style={styles.emptyIcon} />
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
                    {formatManilaDate(rec.visit_date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
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
                  <View>
                    <Text style={styles.modalTitle}>Consultation Record</Text>
                    <Text style={styles.modalSub}>
                      {formatManilaDate(selectedRecord.visit_date, { dateStyle: 'full' })}
                    </Text>
                  </View>
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
                      <View style={{ marginTop: spacing.sm }}>
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
                    <Text style={[styles.secTitle, { color: Colors.success }]}>
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
    backgroundColor: Colors.brandWash,
  },
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.xl,
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
    marginBottom: spacing.sm,
  },
  dpaBanner: {
    backgroundColor: Colors.brandWash,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  dpaBannerText: {
    fontSize: typography.caption.fontSize,
    color: Colors.primaryDark,
    fontWeight: '600',
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
    marginTop: spacing.xl,
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
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  visitDate: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    backgroundColor: Colors.infoBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.info,
  },
  doctorName: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceAlt,
    marginVertical: spacing.sm,
  },
  fieldRow: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.textLight,
  },
  fieldVal: {
    fontSize: typography.caption.fontSize,
    color: Colors.text,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  diagnosisText: {
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  viewDetailText: {
    fontSize: typography.caption.fontSize,
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
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
  },
  modalTitle: {
    fontSize: typography.subhead.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSub: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalBody: {
    marginTop: spacing.lg,
  },
  detailSection: {
    marginBottom: spacing.lg,
    backgroundColor: Colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  highlightSection: {
    backgroundColor: Colors.brandWash,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  prescriptionSection: {
    backgroundColor: Colors.successBackground,
    borderWidth: 1,
    borderColor: Colors.successBackground,
  },
  secTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  secValue: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  secSub: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  secValueText: {
    fontSize: typography.caption.fontSize,
    color: Colors.text,
    lineHeight: typography.caption.lineHeight,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  vitalBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vitalLabel: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  vitalVal: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.text,
    marginTop: spacing.xs,
  },
  diagnosisLarge: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
    lineHeight: typography.small.lineHeight,
  },
  prescriptionText: {
    fontSize: typography.caption.fontSize,
    color: Colors.success,
    fontWeight: '600',
    lineHeight: typography.small.lineHeight,
    fontFamily: 'monospace',
  },
  auditStamp: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  auditStampText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textLight,
  },
});
