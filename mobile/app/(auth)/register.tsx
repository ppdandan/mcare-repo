import { spacing, typography, radius } from '@/theme';
import { userFacingErrorMessage } from '@m-care/shared';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors as Colors } from '@/theme';
import { Button, Card, ScreenHeader, TextField } from '@/components/ui';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, loading } = useAuth();

  // Basic Account
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Profile Details
  const [dateOfBirth, setDateOfBirth] = useState(''); // YYYY-MM-DD
  const [address, setAddress] = useState('');

  // Medical & Emergency
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [obstetricHistory, setObstetricHistory] = useState('');

  // DPA 2012 Consent Checkbox
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMsg(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Please enter your active contact number.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!privacyConsent) {
      setErrorMsg(
        'You must acknowledge and consent to the Philippine Data Privacy Act agreement to register.'
      );
      return;
    }

    try {
      await signUp({
        email,
        password,
        fullName,
        phone,
        dateOfBirth: dateOfBirth.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        bloodType,
        allergies: allergies.trim() || undefined,
        obstetricHistory: obstetricHistory.trim() || undefined,
        privacyConsent: true,
      });

      router.replace('/(auth)/login');
    } catch (err: unknown) {
      setErrorMsg(userFacingErrorMessage(err, 'We couldn’t create your account. Check your details and try again.'));
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <ScreenHeader title="Patient Registration" subtitle="M-Care OB-GYN Clinic & Ultrasound Record Setup" />
          </View>

          {errorMsg && (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Section 1: Account & Identity */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Account Information</Text>

            <TextField label="Full Name *" containerStyle={styles.inputGroup} value={fullName} onChangeText={setFullName} />

            <TextField label="Email Address *" containerStyle={styles.inputGroup} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <TextField label="Mobile Phone Number *" containerStyle={styles.inputGroup} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <TextField label="Password (minimum 6 characters) *" containerStyle={styles.inputGroup} value={password} onChangeText={setPassword} secureTextEntry />

            <TextField label="Confirm Password *" containerStyle={styles.inputGroup} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          </Card>

          {/* Section 2: Personal Details */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Personal Profile</Text>

            <TextField label="Date of Birth (YYYY-MM-DD)" containerStyle={styles.inputGroup} value={dateOfBirth} onChangeText={setDateOfBirth} />

            <TextField label="Home Address" containerStyle={styles.inputGroup} value={address} onChangeText={setAddress} />
          </Card>

          {/* Section 3: Clinical & Emergency Information */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Clinical & Emergency Details</Text>

            <TextField label="Emergency Contact Person & Relationship" containerStyle={styles.inputGroup} value={emergencyContactName} onChangeText={setEmergencyContactName} />

            <TextField label="Emergency Contact Phone" containerStyle={styles.inputGroup} value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} keyboardType="phone-pad" />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Blood Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Blood Type ${bt}`}
                    accessibilityState={{ selected: bloodType === bt }}
                    key={bt}
                    style={[styles.chip, bloodType === bt && styles.chipActive]}
                    onPress={() => setBloodType(bt)}
                  >
                    <Text
                      style={[styles.chipText, bloodType === bt && styles.chipTextActive]}
                    >
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextField label="Known Drug or Food Allergies" containerStyle={styles.inputGroup} value={allergies} onChangeText={setAllergies} />

            <TextField label="Obstetric / Gynecologic Notes" containerStyle={styles.inputGroup} value={obstetricHistory} onChangeText={setObstetricHistory} multiline numberOfLines={3} />
          </Card>

          {/* Section 4: Philippine Data Privacy Act Consent */}
          <Card style={styles.consentCard}>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyConsent }}
              style={styles.checkboxContainer}
              onPress={() => setPrivacyConsent(!privacyConsent)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  privacyConsent && styles.checkboxChecked,
                ]}
              >
                {privacyConsent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentTitle}>
                  Data Privacy Consent (RA 10173) *
                </Text>
                <Text style={styles.consentDescription}>
                  I hereby declare that I voluntarily give my consent to M-Care OB-GYN
                  Clinic & Ultrasound to collect, process, and securely store my personal
                  and sensitive health information strictly for medical consultation,
                  treatment scheduling, and patient record management in accordance with the
                  Philippine Data Privacy Act of 2012.
                </Text>
              </View>
            </TouchableOpacity>
          </Card>

          {/* Submit Button */}
          <Button onPress={handleRegister} loading={loading} disabled={loading}>Create Patient Account</Button>

          <View style={styles.footerPrompt}>
            <Text style={styles.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In Here</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/privacy' as never)} accessibilityRole="link" style={{ marginTop: spacing.lg }}>
            <Text style={{ color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' }}>Privacy Policy</Text>
          </TouchableOpacity>
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
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: Colors.primary,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: Colors.errorBackground,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: Colors.error,
    fontWeight: '500',
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: spacing.lg,
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
  multilineInput: {
    height: 72,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: spacing.sm,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.brandSoft,
  },
  chipText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.primaryDark,
  },
  consentCard: {
    backgroundColor: Colors.errorBackground,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: Colors.errorBackground,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    backgroundColor: Colors.background,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: Colors.background,
    fontSize: typography.small.fontSize,
    fontWeight: 'bold',
  },
  consentTextContainer: {
    flex: 1,
  },
  consentTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: spacing.xs,
  },
  consentDescription: {
    fontSize: typography.caption.fontSize,
    color: Colors.error,
    lineHeight: typography.caption.lineHeight,
  },
  submitButton: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.background,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  footerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.caption.fontSize,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.primary,
  },
});

