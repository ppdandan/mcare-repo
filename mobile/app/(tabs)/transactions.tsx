import { spacing, typography, radius } from '@/theme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors as Colors } from '@/theme';
import { formatManilaDate, formatManilaDateTime } from '@m-care/shared';
import type { TransactionWithAppointment } from '@m-care/shared';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, ScreenHeader } from '@/components/ui';

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { patient } = useAuth();
  const [transactions, setTransactions] = useState<TransactionWithAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!patient?.profile_id) {
      setLoading(false);
      setRefreshing(false);
      setError('Your patient profile is not ready. Please sign in again.');
      return;
    }
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select(`
          *,
          appointment:appointments (
            *,
            service:services (*)
          )
        `)
        .eq('user_id', patient.profile_id)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setTransactions((data ?? []) as unknown as TransactionWithAppointment[]);
    } catch (cause) {
      console.error('Unable to load transaction history:', cause);
      setError('We couldn’t load your transaction history. Check your connection and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patient?.profile_id]);

  useEffect(() => {
    void fetchTransactions();
    if (!patient?.profile_id) return;
    const channel = supabase
      .channel(`patient_transactions_${patient.profile_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${patient.profile_id}`,
      }, () => { void fetchTransactions(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchTransactions, patient?.profile_id]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchTransactions();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ScreenHeader title="Transaction History" subtitle="In-person payments recorded by the clinic after your visit." />
          <Text style={styles.note}>This screen is for records only. It does not collect payments.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {loading ? (
            <LoadingState label="Loading transaction history…" />
          ) : error ? (
            <ErrorState title="History unavailable" message={error} onRetry={() => { setLoading(true); void fetchTransactions(); }} />
          ) : transactions.length === 0 ? (
            <EmptyState title="No transactions yet" description="After your clinic visit is completed and paid in person, the clinic can add the record here.">
              <Button variant="outline" onPress={() => router.push('/(tabs)/appointments')}>View appointments</Button>
            </EmptyState>
          ) : transactions.map((transaction) => (
            <Card key={transaction.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{transaction.appointment?.service?.name ?? 'Clinic service'}</Text>
                {transaction.voided_at ? <Badge tone="error">Voided</Badge> : null}
              </View>
              <Text selectable style={styles.amount}>{formatAmount(transaction.amount, transaction.currency)}</Text>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.label}>Appointment</Text>
                <Text style={styles.value}>
                  {transaction.appointment?.start_time
                    ? formatManilaDateTime(transaction.appointment.start_time)
                    : 'Date unavailable'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Recorded</Text>
                <Text style={styles.value}>{formatManilaDate(transaction.created_at, { dateStyle: 'medium' })}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Payment method</Text>
                <Text style={styles.value}>{transaction.payment_method}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Reference</Text>
                <Text selectable style={styles.value}>MC-{transaction.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              {transaction.notes ? <Text style={styles.notes}>{transaction.notes}</Text> : null}
              {transaction.voided_at ? (
                <Text style={styles.voidText}>Voided {formatManilaDate(transaction.voided_at)}{transaction.void_reason ? `: ${transaction.void_reason}` : ''}</Text>
              ) : null}
            </Card>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1 },
  header: { backgroundColor: Colors.background, paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.text, fontSize: typography.heading.fontSize, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: typography.small.fontSize, lineHeight: typography.small.lineHeight, marginTop: spacing.sm },
  note: { color: Colors.primaryDark, fontSize: typography.caption.fontSize, fontWeight: '700', marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.lg },
  stateCard: { alignItems: 'center', backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: radius.xl, borderWidth: 1, padding: spacing['2xl'], gap: spacing.sm },
  errorCard: { alignItems: 'flex-start', backgroundColor: Colors.background, borderColor: Colors.error, borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, gap: spacing.sm },
  stateTitle: { color: Colors.text, fontSize: typography.subhead.fontSize, fontWeight: '800', textAlign: 'center' },
  stateText: { color: Colors.textSecondary, fontSize: typography.small.fontSize, lineHeight: typography.small.lineHeight, textAlign: 'center' },
  errorText: { color: Colors.text, fontSize: typography.small.fontSize, lineHeight: typography.small.lineHeight },
  emptyIcon: { fontSize: typography.largeTitle.fontSize },
  card: { backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg },
  cardTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  serviceName: { color: Colors.text, flex: 1, fontSize: typography.body.fontSize, fontWeight: '800' },
  amount: { color: Colors.primaryDark, fontSize: typography.heading.fontSize, fontWeight: '800', marginTop: spacing.sm },
  divider: { backgroundColor: Colors.border, height: 1, marginVertical: spacing.lg },
  detailRow: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.sm },
  label: { color: Colors.textSecondary, flex: 1, fontSize: typography.caption.fontSize },
  value: { color: Colors.text, flex: 1.2, minWidth: 0, fontSize: typography.caption.fontSize, fontWeight: '600', textAlign: 'right' },
  notes: { color: Colors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: spacing.xs },
  voidBadge: { backgroundColor: Colors.errorBackground, borderRadius: radius.xl, color: Colors.error, fontSize: typography.caption.fontSize, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  voidText: { color: Colors.error, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, marginTop: spacing.sm },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: Colors.primaryDark, borderRadius: radius.md, marginTop: spacing.xs, paddingVertical: spacing.md },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: typography.small.fontSize, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: Colors.primaryDark, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  secondaryButtonText: { color: Colors.primaryDark, fontSize: typography.small.fontSize, fontWeight: '800' },
});
