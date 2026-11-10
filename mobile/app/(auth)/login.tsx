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
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import Colors from '@/constants/Colors';
import PregnantWomanLogo from '@/components/PregnantWomanLogo';
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
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to log in. Please check your credentials.');
      }
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
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to send OTP code. Please try again.');
      }
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
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Invalid or expired OTP code.');
      }
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
            <PregnantWomanLogo size={80} />
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
                style={{ marginRight: 6 }}
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
                style={{ marginRight: 6 }}
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
                <Ionicons name="alert-circle" size={18} color="#991B1B" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#065F46" style={{ marginRight: 6 }} />
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
                      <Text style={[styles.buttonText, { marginLeft: 8 }]}>Signing in...</Text>
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
                          <Text style={[styles.buttonText, { marginLeft: 8 }]}>Verifying...</Text>
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
                        <Text style={[styles.buttonText, { marginLeft: 8 }]}>Sending code...</Text>
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

            {/* Staff Disclaimer */}
            <View style={styles.staffDisclaimer}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.textLight} style={{ marginRight: 4 }} />
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
    backgroundColor: '#FFF7F9',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topNav: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FCE7F3',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  patientBadge: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3E8FF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: Colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: Colors.text,
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    marginBottom: 10,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  resendLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
    fontSize: 16,
    fontWeight: '700',
  },
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  promptText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  staffDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
