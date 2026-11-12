import { spacing, typography, radius } from '@/theme';
import { userFacingErrorMessage } from '@m-care/shared';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors as Colors } from '@/theme';
import { Button, Card, ScreenHeader, TextField } from '@/components/ui';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, patient, refreshProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [bloodType, setBloodType] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [obstetricHistory, setObstetricHistory] = useState('');

  const [saving, setSaving] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
    }
    if (patient) {
      setEmergencyName(patient.emergency_contact_name || '');
      setEmergencyPhone(patient.emergency_contact_phone || '');
      setBloodType(patient.blood_type || 'O+');
      setAllergies(patient.allergies || '');
      setObstetricHistory(patient.obstetric_history || '');
    }
  }, [profile, patient]);

  const handleSaveProfile = async () => {
    if (!profile?.id || !patient?.id) return;
    setSaving(true);
    try {
      // 1. Update Profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
        })
        .eq('id', profile.id);

      if (profileErr) throw profileErr;

      // 2. Update Patient details
      const { error: patientErr } = await supabase
        .from('patients')
        .update({
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          blood_type: bloodType,
          allergies: allergies.trim() || null,
          obstetric_history: obstetricHistory.trim() || null,
        })
        .eq('id', patient.id);

      if (patientErr) throw patientErr;

      await refreshProfile();
      Alert.alert('Profile Updated', 'Your personal and clinical details have been saved.');
    } catch (err: unknown) {
      const message = userFacingErrorMessage(err, 'We couldn’t save your profile. Check your connection and try again.');
      Alert.alert('Update Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your login and direct contact details will be removed, push tokens and notifications erased, and future appointments cancelled. Clinical records and audit history may be retained without direct identifiers for the clinic’s approved retention period. This cannot be undone.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                body: { password: deletionPassword || undefined },
              });
              if (error) throw error;
              await signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              Alert.alert('Deletion could not be completed', userFacingErrorMessage(error, 'We couldn’t complete the request. Contact the clinic for help.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <ScreenHeader title="Patient Profile & Health Details" subtitle="Keep your contact and emergency information up to date" />
          </View>

          {/* Section 1: Basic Information */}
          <Card style={styles.card}>
            <Text style={styles.cardSectionTitle}>Account Details</Text>

            <TextField label="Full Name" containerStyle={styles.inputGroup} value={fullName} onChangeText={setFullName} />

            <TextField label="Mobile Phone" containerStyle={styles.inputGroup} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <TextField label="Home Address" containerStyle={styles.inputGroup} value={address} onChangeText={setAddress} />
          </Card>

          {/* Section 2: Clinical & Emergency Information */}
          <Card style={styles.card}>
            <Text style={styles.cardSectionTitle}>Clinical & Emergency Records</Text>

            <TextField label="Emergency Contact Person" containerStyle={styles.inputGroup} value={emergencyName} onChangeText={setEmergencyName} />

            <TextField label="Emergency Phone" containerStyle={styles.inputGroup} value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" />

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
                    <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextField label="Known Drug or Food Allergies" containerStyle={styles.inputGroup} value={allergies} onChangeText={setAllergies} />

            <TextField label="Obstetric / Gynecologic History" containerStyle={styles.inputGroup} value={obstetricHistory} onChangeText={setObstetricHistory} multiline numberOfLines={3} />
          </Card>

          {/* Save Button */}
          <Button onPress={handleSaveProfile} loading={saving} disabled={saving}>Save Profile Changes</Button>

          {/* Sign Out Button */}
          <Button variant="outline" onPress={handleSignOut}>Sign Out of Patient Account</Button>
          <TouchableOpacity onPress={() => router.push('/privacy' as never)} accessibilityRole="link" style={{ padding: spacing.lg }}>
            <Text style={{ color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' }}>Privacy Policy</Text>
          </TouchableOpacity>
          <View style={styles.deleteCard}>
            <Text style={styles.cardSectionTitle}>Delete account</Text>
            <Text style={styles.deleteDescription}>Enter your password if you have not signed in within the last 10 minutes. You can also sign out and sign in again before continuing.</Text>
            <TextInput
              style={styles.input}
              value={deletionPassword}
              onChangeText={setDeletionPassword}
              placeholder="Password (optional for recent sign-in)"
              secureTextEntry
              autoCapitalize="none"
              editable={!deleting}
             placeholderTextColor={Colors.textLight} />
            <TouchableOpacity style={[styles.deleteBtn, deleting && styles.btnDisabled]} onPress={handleDeleteAccount} disabled={deleting}>
              {deleting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.deleteBtnText}>Delete my account</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.brandWash },
  container: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing['4xl'] },
  header: { marginBottom: spacing.lg },
  title: { fontSize: typography.title.fontSize, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, marginTop: spacing.xs },
  card: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
  },
  cardSectionTitle: {
    fontSize: typography.small.fontSize,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: spacing.md,
  },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: typography.caption.fontSize, fontWeight: '600', color: Colors.textSecondary, marginBottom: spacing.xs },
  input: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.small.fontSize,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  multilineInput: {
    height: 70,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: spacing.sm,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.brandSoft },
  chipText: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primaryDark },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.background, fontSize: typography.small.fontSize, fontWeight: '700' },
  signOutBtn: {
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.errorBackground,
    backgroundColor: Colors.errorBackground,
  },
  signOutText: { color: Colors.error, fontSize: typography.small.fontSize, fontWeight: '700' },
  deleteCard: {
    backgroundColor: Colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: Colors.errorBackground,
  },
  deleteDescription: { fontSize: typography.caption.fontSize, color: Colors.textSecondary, marginBottom: spacing.md, lineHeight: typography.caption.lineHeight },
  deleteBtn: {
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
  },
  deleteBtnText: { color: Colors.background, fontSize: typography.small.fontSize, fontWeight: '700' },
});
