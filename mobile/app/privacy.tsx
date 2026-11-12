import { spacing, typography } from '@/theme';
import { colors as Colors } from '@/theme';
// TODO: The clinic must review this privacy policy text before release.
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { PRIVACY_POLICY } from '@m-care/shared/privacy-policy';
import { Card } from '@/components/ui';

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            <Text selectable style={styles.policy}>{PRIVACY_POLICY.trim()}</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.brandWash },
  content: { padding: spacing.xl, paddingBottom: 0, backgroundColor: Colors.brandWash },
  card: { padding: spacing.lg },
  policy: { color: Colors.text, fontSize: typography.small.fontSize, lineHeight: typography.body.lineHeight },
});
