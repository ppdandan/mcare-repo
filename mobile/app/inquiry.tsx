import { spacing, typography, radius } from '@/theme';
import { userFacingErrorMessage } from '@m-care/shared';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors as Colors } from '@/theme';
import { formatManilaDateTime, formatManilaTime } from '@m-care/shared';
import type { Inquiry } from '@m-care/shared';
import { Badge, Button, Card, EmptyState, LoadingState, ScreenHeader, TextField } from '@/components/ui';

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
      Alert.alert('Inquiry not sent', userFacingErrorMessage(err, 'We couldn’t send your inquiry. Check your connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.title}>Clinic messages</Text>
        </View>

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
          <View style={styles.composeAction}>
            <Button variant={showForm ? 'outline' : 'primary'} onPress={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel message' : 'New message'}
            </Button>
          </View>
          {/* New Inquiry Compose Box */}
          {showForm && (
            <Card style={styles.formCard}>
              <Text style={styles.formHeading}>New message</Text>

              <TextField label="Subject" containerStyle={styles.inputGroup} value={subject} onChangeText={setSubject} />

              <TextField label="Your Message" containerStyle={styles.inputGroup} value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top" style={{ minHeight: 100 }} />

              <Button onPress={handleSendInquiry} loading={submitting} disabled={submitting}>Send message</Button>
            </Card>
          )}

          {/* Messages List */}
          {loading ? (
            <LoadingState label="Loading inquiries..." />
          ) : inquiries.length === 0 ? (showForm ? null :
            <EmptyState
              title="No messages yet"
              description={'Your messages and replies from the clinic will appear here.'}
            />
          ) : (
            inquiries.map((inq) => (
              <Card key={inq.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardSubject}>{inq.subject}</Text>
                  <Badge tone={inq.status === 'replied' ? 'success' : inq.status === 'closed' ? 'neutral' : 'warning'}>{inq.status.toUpperCase()}</Badge>
                </View>

                <Text style={styles.cardDate}>
                  Sent: {formatManilaDateTime(inq.created_at)}
                </Text>

                <View style={styles.patientMsgBox}>
                  <Text style={styles.patientMsgText}>{inq.message}</Text>
                </View>

                {inq.reply ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>Clinic reply</Text>
                    <Text style={styles.replyText}>{inq.reply}</Text>
                    <Text style={styles.replyDate}>
                      Updated: {formatManilaTime(inq.updated_at)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pendingReplyBox}>
                    <Text style={styles.pendingReplyText}>
                      Waiting for a reply
                    </Text>
                  </View>
                )}
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  composeAction: { marginBottom: spacing.md },
  safeArea: { flex: 1, backgroundColor: Colors.brandWash },
  container: { flex: 1 },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandSoft,
  },
  backBtn: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backBtnText: { fontSize: typography.caption.fontSize, fontWeight: '600', color: Colors.primary },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: typography.title.fontSize, fontWeight: '700', color: Colors.text },
  newBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  newBtnText: { color: Colors.background, fontSize: typography.caption.fontSize, fontWeight: '700' },
  subtitle: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, marginTop: spacing.xs },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  formCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.brandSoft,
  },
  formHeading: { fontSize: typography.small.fontSize, fontWeight: '700', color: Colors.primaryDark, marginBottom: spacing.md },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: typography.caption.fontSize, fontWeight: '600', color: Colors.textSecondary, marginBottom: spacing.xs },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.caption.fontSize,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  textArea: {
    height: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  sendBtnText: { color: Colors.background, fontSize: typography.small.fontSize, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  centerBox: { padding: spacing['4xl'], alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.caption.fontSize, color: Colors.textSecondary },
  emptyCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.xl,
    padding: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    marginTop: spacing.xl,
  },
  emptyIcon: { fontSize: typography.largeTitle.fontSize, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.body.fontSize, fontWeight: '700', color: Colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, textAlign: 'center', lineHeight: typography.caption.lineHeight },
  card: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSubject: { fontSize: typography.small.fontSize, fontWeight: '700', color: Colors.text, flex: 1, marginRight: spacing.sm },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  pillOpen: { backgroundColor: Colors.warningBackground },
  pillReplied: { backgroundColor: Colors.successBackground },
  pillClosed: { backgroundColor: Colors.surfaceAlt },
  statusPillText: { fontSize: typography.caption.fontSize, fontWeight: '700', color: Colors.text },
  cardDate: { fontSize: typography.caption.fontSize, color: Colors.textLight, marginTop: spacing.xs, marginBottom: spacing.sm },
  patientMsgBox: {
    backgroundColor: Colors.brandWash,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  patientMsgText: { ...typography.body, color: Colors.text },
  replyBox: {
    backgroundColor: Colors.successBackground,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  replyLabel: { fontSize: typography.caption.fontSize, fontWeight: '700', color: Colors.success, marginBottom: spacing.xs },
  replyText: { ...typography.body, color: Colors.text },
  replyDate: { fontSize: typography.caption.fontSize, color: Colors.success, marginTop: spacing.xs, textAlign: 'right' },
  pendingReplyBox: {
    backgroundColor: Colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  pendingReplyText: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, fontStyle: 'italic' },
});

