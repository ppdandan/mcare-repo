import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';

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
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      Alert.alert('Update Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Patient Profile & Health Details</Text>
            <Text style={styles.subtitle}>
              Keep your contact and emergency information up to date
            </Text>
          </View>

          {/* Section 1: Basic Information */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Account Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="0917 123 4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Home Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Barangay, City, Province"
              />
            </View>
          </View>

          {/* Section 2: Clinical & Emergency Information */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Clinical & Emergency Records</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Emergency Contact Person</Text>
              <TextInput
                style={styles.input}
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="Name and relationship"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Emergency Phone</Text>
              <TextInput
                style={styles.input}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Emergency Contact Phone"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Blood Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Known Drug or Food Allergies</Text>
              <TextInput
                style={styles.input}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="e.g. Penicillin, Aspirin, or None"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Obstetric / Gynecologic History</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={obstetricHistory}
                onChangeText={setObstetricHistory}
                placeholder="e.g. G2P1 (1 CS delivery), menstrual cycle notes"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile Changes</Text>
            )}
          </TouchableOpacity>

          {/* Sign Out Button */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out of Patient Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7F9' },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCE7F3',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 12,
  },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  multilineInput: {
    height: 70,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: '#FDE7F3' },
  chipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primaryDark },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  signOutBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  signOutText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});
