import { spacing, typography, radius } from '@m-care/shared';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/Colors';

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
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Sign In</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.description}>
              Enter the email address registered with your M-Care patient account.
              We will send you a secure link to reset your password.
            </Text>

            {submitted ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Check Your Inbox</Text>
                <Text style={styles.successText}>
                  A password reset link has been dispatched to {email}. Follow the
                  link in the email to set a new password.
                </Text>
                <TouchableOpacity
                  style={styles.returnButton}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.returnButtonText}>Return to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. maria@example.com"
                    placeholderTextColor={Colors.textLight}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || !email.trim()}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
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
    backgroundColor: Colors.background,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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

