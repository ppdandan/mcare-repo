import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
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
import type { Inquiry } from '@m-care/shared';

export default function InquiryScreen() {
  const router = useRouter();
  const { patient } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Inquiry form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchInquiries = useCallback(async () => {
    if (!patient?.id) return;
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setInquiries(data as Inquiry[]);
    } catch (err) {
      console.error('Error fetching inquiries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    fetchInquiries();

    if (!patient?.id) return;

    // Realtime channel
    const channel = supabase
      .channel(`patient_inquiries_${patient.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inquiries',
          filter: `patient_id=eq.${patient.id}`,
        },
        () => {
          fetchInquiries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInquiries, patient?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInquiries();
  };

  const handleSendInquiry = async () => {
    if (!subject.trim() || !message.trim() || !patient?.id) {
      Alert.alert('Incomplete Message', 'Please enter a subject and message.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('inquiries').insert({
        patient_id: patient.id,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
      });

      if (error) throw error;

      Alert.alert('Inquiry Sent', 'Clinic reception will review and respond to your inquiry.');
      setSubject('');
      setMessage('');
      setShowForm(false);
      await fetchInquiries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Clinic Inquiry & Support</Text>
            <TouchableOpacity
              onPress={() => setShowForm(!showForm)}
              style={styles.newBtn}
            >
              <Text style={styles.newBtnText}>{showForm ? 'Cancel' : '+ New Message'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Direct messaging with M-Care clinic reception desk
          </Text>
        </View>

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
          {/* New Inquiry Compose Box */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formHeading}>Compose Inquiry to Clinic</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Question on Ultrasound fasting requirements"
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Your Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Type your question or inquiry here..."
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={[styles.sendBtn, submitting && styles.btnDisabled]}
                onPress={handleSendInquiry}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendBtnText}>Send Message to Clinic</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Messages List */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading inquiries...</Text>
            </View>
          ) : inquiries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No Inquiries Sent</Text>
              <Text style={styles.emptyText}>
                Have a question about a service, procedure preparation, or scheduling?
                Tap "+ New Message" to send a direct message to our staff.
              </Text>
            </View>
          ) : (
            inquiries.map((inq) => (
              <View key={inq.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardSubject}>{inq.subject}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      inq.status === 'replied'
                        ? styles.pillReplied
                        : inq.status === 'closed'
                        ? styles.pillClosed
                        : styles.pillOpen,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {inq.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDate}>
                  Sent: {new Date(inq.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>

                <View style={styles.patientMsgBox}>
                  <Text style={styles.patientMsgText}>{inq.message}</Text>
                </View>

                {inq.reply ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>Clinic Staff Response:</Text>
                    <Text style={styles.replyText}>{inq.reply}</Text>
                    <Text style={styles.replyDate}>
                      Updated: {new Date(inq.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pendingReplyBox}>
                    <Text style={styles.pendingReplyText}>
                      ⏳ Awaiting response from reception staff...
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7F9' },
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FCE7F3',
  },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  newBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FCE7F3',
  },
  formHeading: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark, marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  textArea: {
    height: 80,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  centerBox: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 13, color: Colors.textSecondary },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 20,
  },
  emptyIcon: { fontSize: 38, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSubject: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillOpen: { backgroundColor: '#FEF3C7' },
  pillReplied: { backgroundColor: '#D1FAE5' },
  pillClosed: { backgroundColor: '#F3F4F6' },
  statusPillText: { fontSize: 10, fontWeight: '700', color: Colors.text },
  cardDate: { fontSize: 11, color: Colors.textLight, marginTop: 4, marginBottom: 10 },
  patientMsgBox: {
    backgroundColor: '#FFF5F8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  patientMsgText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  replyBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#065F46', marginBottom: 2 },
  replyText: { fontSize: 13, color: '#047857', lineHeight: 18 },
  replyDate: { fontSize: 10, color: '#6EE7B7', marginTop: 4, textAlign: 'right' },
  pendingReplyBox: {
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 6,
  },
  pendingReplyText: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
});

