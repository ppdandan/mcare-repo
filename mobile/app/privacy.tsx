// TODO: The clinic must review this privacy policy text before release.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { PRIVACY_POLICY } from '@m-care/shared/privacy-policy';

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text selectable style={styles.policy}>{PRIVACY_POLICY.trim()}</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, backgroundColor: '#FFF7F9' },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FCE7F3' },
  policy: { color: '#29232B', fontSize: 15, lineHeight: 23 },
});
