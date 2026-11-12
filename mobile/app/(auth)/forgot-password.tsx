import { spacing, typography, radius } from '@/theme';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors as Colors } from '@/theme';
import { Button, Card, ScreenHeader, TextField } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch {
      // Handled in auth context
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Sign In</Text>
          </TouchableOpacity>

          <Card style={styles.card}>
            <ScreenHeader title="Reset Password" subtitle="Enter the email address registered with your M-Care patient account. We will send you a secure link to reset your password." />

            {submitted ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Check Your Inbox</Text>
                <Text style={styles.successText}>
                  A password reset link has been dispatched to {email}. Follow the
                  link in the email to set a new password.
                </Text>
                <Button variant="secondary" onPress={() => router.replace('/(auth)/login')}>Return to Login</Button>
              </View>
            ) : (
              <>
                <TextField label="Email Address" containerStyle={styles.inputGroup} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                <Button onPress={handleSubmit} loading={loading} disabled={loading || !email.trim()}>Send Reset Link</Button>
              </>
            )}
          </Card>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  content: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  card: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    lineHeight: typography.caption.lineHeight,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: spacing.lg,
    fontSize: typography.small.fontSize,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  button: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: Colors.successBackground,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: Colors.successBackground,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.caption.fontSize,
    color: Colors.success,
    textAlign: 'center',
    lineHeight: typography.caption.lineHeight,
    marginBottom: spacing.lg,
  },
  returnButton: {
    backgroundColor: Colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  returnButtonText: {
    color: Colors.background,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
});

