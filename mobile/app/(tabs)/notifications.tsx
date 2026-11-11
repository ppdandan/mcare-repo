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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import { formatManilaDateTime } from '@m-care/shared';
import type { Notification } from '@m-care/shared';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
      } else if (data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    // Realtime listener for incoming notifications
    const channel = supabase
      .channel(`user_notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.warn('Error marking read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn('Error marking all read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount} New</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>
            Live alerts for appointment confirmations, reschedules, and visit reminders
          </Text>

          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
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
              <Text style={styles.loadingText}>Checking notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-outline" size={40} color={Colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptyText}>
                You will receive alerts here when clinic staff confirms your appointment or sends clinical reminders.
              </Text>
            </View>
          ) : (
            notifications.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.is_read && styles.unreadCard]}
                onPress={() => markAsRead(n.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    {!n.is_read && <View style={styles.unreadDot} />}
                    <Text style={[styles.cardTitle, !n.is_read && styles.unreadTitle]}>
                      {n.title}
                    </Text>
                  </View>
                  <Text style={styles.timeAgo}>
                    {formatManilaDateTime(n.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.cardBody}>{n.body}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.brandWash },
  container: { flex: 1 },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandSoft,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: typography.title.fontSize, fontWeight: '700', color: Colors.text },
  badge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  badgeText: { color: Colors.background, fontSize: typography.caption.fontSize, fontWeight: '700' },
  subtitle: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, marginTop: spacing.xs },
  markAllBtn: { alignSelf: 'flex-start', marginTop: spacing.sm },
  markAllText: { fontSize: typography.caption.fontSize, fontWeight: '700', color: Colors.primary },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
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
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
  },
  unreadCard: {
    backgroundColor: Colors.brandWash,
    borderColor: Colors.brandSoft,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.sm },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: Colors.primary,
    marginRight: spacing.sm,
  },
  cardTitle: { fontSize: typography.small.fontSize, fontWeight: '600', color: Colors.text },
  unreadTitle: { fontWeight: '700', color: Colors.primaryDark },
  timeAgo: { fontSize: typography.caption.fontSize, color: Colors.textLight },
  cardBody: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, lineHeight: typography.caption.lineHeight },
});

