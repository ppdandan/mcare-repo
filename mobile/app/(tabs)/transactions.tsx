import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { formatManilaDate, formatManilaDateTime } from '@m-care/shared';
import type { TransactionWithAppointment } from '@m-care/shared';

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
          <Text style={styles.title}>Transaction History</Text>
          <Text style={styles.subtitle}>In-person payments recorded by the clinic after your visit.</Text>
          <Text style={styles.note}>This screen is for records only. It does not collect payments.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={Colors.primaryDark} />
              <Text style={styles.stateText}>Loading transaction history…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Text style={styles.stateTitle}>History unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => { setLoading(true); void fetchTransactions(); }}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.stateTitle}>No transactions yet</Text>
              <Text style={styles.stateText}>After your clinic visit is completed and paid in person, the clinic can add the record here.</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(tabs)/appointments')}>
                <Text style={styles.secondaryButtonText}>View appointments</Text>
              </TouchableOpacity>
            </View>
          ) : transactions.map((transaction) => (
            <View key={transaction.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName}>{transaction.appointment?.service?.name ?? 'Clinic service'}</Text>
                {transaction.voided_at ? <Text style={styles.voidBadge}>Voided</Text> : null}
              </View>
              <Text style={styles.amount}>{formatAmount(transaction.amount, transaction.currency)}</Text>
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
                <Text style={styles.value}>MC-{transaction.id.slice(0, 8).toUpperCase()}</Text>
              </View>
              {transaction.notes ? <Text style={styles.notes}>{transaction.notes}</Text> : null}
              {transaction.voided_at ? (
                <Text style={styles.voidText}>Voided {formatManilaDate(transaction.voided_at)}{transaction.void_reason ? `: ${transaction.void_reason}` : ''}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1 },
  header: { backgroundColor: Colors.background, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  note: { color: Colors.primaryDark, fontSize: 13, fontWeight: '700', marginTop: 8 },
  content: { padding: 18, paddingBottom: 34, gap: 14 },
  stateCard: { alignItems: 'center', backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: 18, borderWidth: 1, padding: 24, gap: 10 },
  errorCard: { alignItems: 'flex-start', backgroundColor: Colors.background, borderColor: Colors.error, borderRadius: 18, borderWidth: 1, padding: 20, gap: 10 },
  stateTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  stateText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  emptyIcon: { fontSize: 34 },
  card: { backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: 18, borderWidth: 1, padding: 18 },
  cardTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  serviceName: { color: Colors.text, flex: 1, fontSize: 17, fontWeight: '800' },
  amount: { color: Colors.primaryDark, fontSize: 24, fontWeight: '800', marginTop: 10 },
  divider: { backgroundColor: Colors.border, height: 1, marginVertical: 14 },
  detailRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  label: { color: Colors.textSecondary, flex: 1, fontSize: 13 },
  value: { color: Colors.text, flex: 1.2, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  notes: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  voidBadge: { backgroundColor: '#FEE2E2', borderRadius: 20, color: '#991B1B', fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4 },
  voidText: { color: '#991B1B', fontSize: 12, lineHeight: 18, marginTop: 8 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: Colors.primaryDark, borderRadius: 12, marginTop: 4, paddingVertical: 12 },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: Colors.primaryDark, borderRadius: 12, borderWidth: 1, marginTop: 6, paddingHorizontal: 18, paddingVertical: 11 },
  secondaryButtonText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '800' },
});
