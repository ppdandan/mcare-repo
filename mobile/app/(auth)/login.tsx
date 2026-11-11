import { spacing, typography, radius, userFacingErrorMessage } from '@m-care/shared';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

type LoginMode = 'password' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithOtp, verifyOtp, loading } = useAuth();

  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const handlePasswordLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await signIn(cleanEmail, password);
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      setErrorMessage(userFacingErrorMessage(err, 'Unable to log in. Please check your credentials.'));
    }
  };

  const handleRequestOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address to receive an OTP code.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await signInWithOtp(cleanEmail);
      setOtpSent(true);
      setSuccessMessage('A 6-digit one-time passcode was sent to your email.');
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 200);
    } catch (err: unknown) {
      setErrorMessage(userFacingErrorMessage(err, 'We couldn’t send a sign-in code. Check your email address and try again.'));
    }
  };

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanOtp) {
      setErrorMessage('Please enter both your email and the 6-digit OTP code.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await verifyOtp(cleanEmail, cleanOtp);
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      setErrorMessage(userFacingErrorMessage(err, 'We couldn’t verify that code. Request a new code and try again.'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar Navigation */}
          <View style={styles.topNav}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Header with Pregnant Woman Logo */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              accessibilityLabel="M-Care logo"
              resizeMode="contain"
              style={{ width: 80, height: 93 }}
            />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>M-Care OB-GYN & Ultrasound Clinic</Text>
            <Text style={styles.patientBadge}>Patient Portal</Text>
          </View>

          {/* Login Mode Selector Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'password' && styles.tabButtonActive]}
              onPress={() => {
                setMode('password');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="key-outline"
                size={16}
                color={mode === 'password' ? Colors.primary : Colors.textSecondary}
                style={{ marginRight: spacing.sm }}
              />
              <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>
                Password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, mode === 'otp' && styles.tabButtonActive]}
              onPress={() => {
                setMode('otp');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={mode === 'otp' ? Colors.primary : Colors.textSecondary}
                style={{ marginRight: spacing.sm }}
              />
              <Text style={[styles.tabText, mode === 'otp' && styles.tabTextActive]}>
                OTP Code
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: spacing.sm }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={{ marginRight: spacing.sm }} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Email Field with email keyboard & auto-trim */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={19} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. bea.alonzo@example.com"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={(text) => setEmail(text.trim())}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType={mode === 'password' ? 'next' : otpSent ? 'next' : 'send'}
                  onSubmitEditing={() => {
                    if (mode === 'password') {
                      passwordInputRef.current?.focus();
                    } else if (otpSent) {
                      otpInputRef.current?.focus();
                    } else {
                      handleRequestOtp();
                    }
                  }}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Password Flow */}
            {mode === 'password' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <Ionicons name="lock-closed-outline" size={19} color={Colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handlePasswordLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password Link */}
                <View style={styles.forgotRow}>
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/forgot-password')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handlePasswordLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                      <Text style={[styles.buttonText, { marginLeft: spacing.sm }]}>Signing in...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* OTP Flow */}
            {mode === 'otp' && (
              <View style={styles.inputGroup}>
                {otpSent ? (
                  <>
                    <Text style={styles.label}>Enter 6-Digit OTP Code</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="keypad-outline"
                        size={19}
                        color={Colors.textLight}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={otpInputRef}
                        style={[styles.input, { letterSpacing: 4, fontWeight: '700' }]}
                        placeholder="123456"
                        placeholderTextColor={Colors.textLight}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={8}
                        returnKeyType="go"
                        onSubmitEditing={handleVerifyOtp}
                      />
                    </View>

                    <View style={styles.resendRow}>
                      <Text style={styles.resendLabel}>Didn't receive the code? </Text>
                      <TouchableOpacity onPress={handleRequestOtp} disabled={loading}>
                        <Text style={styles.resendLink}>Resend OTP</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                          <Text style={[styles.buttonText, { marginLeft: spacing.sm }]}>Verifying...</Text>
                        </View>
                      ) : (
                        <Text style={styles.buttonText}>Verify & Sign In</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRequestOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                        <Text style={[styles.buttonText, { marginLeft: spacing.sm }]}>Sending code...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Send One-Time Code</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Registration Link */}
            <View style={styles.registerPrompt}>
              <Text style={styles.promptText}>New patient at M-Care? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
                <Text style={styles.registerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => router.push('/privacy' as never)} accessibilityRole="link" style={{ marginTop: spacing.lg }}>
              <Text style={{ color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' }}>Privacy Policy</Text>
            </TouchableOpacity>

            {/* Staff Disclaimer */}
            <View style={styles.staffDisclaimer}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.textLight} style={{ marginRight: spacing.xs }} />
              <Text style={styles.disclaimerText}>
                Clinic staff & doctors sign in via the reception web terminal.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.brandWash,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  topNav: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: Colors.brandSoft,
  },
  backButtonText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: '800',
    color: Colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.small.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  patientBadge: {
    marginTop: spacing.sm,
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
    backgroundColor: Colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tabButtonActive: {
    backgroundColor: Colors.background,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorBackground,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: typography.caption.fontSize,
    color: Colors.error,
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successBackground,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  successText: {
    flex: 1,
    fontSize: typography.caption.fontSize,
    color: Colors.success,
    fontWeight: '600',
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.small.fontSize,
    color: Colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: spacing.md,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: typography.small.fontSize,
    color: Colors.text,
  },
  eyeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  forgotText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  resendLabel: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primary,
  },
  button: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  promptText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primary,
  },
  staffDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  disclaimerText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
