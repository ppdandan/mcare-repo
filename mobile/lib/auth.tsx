import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, Patient } from '@m-care/shared';

export interface RegisterPatientParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodType?: string;
  allergies?: string;
  obstetricHistory?: string;
  privacyConsent: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  patient: Patient | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signUp: (params: RegisterPatientParams) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const ensureProfileRecord = async (authUser: User) => {
    const metadata = authUser.user_metadata ?? {};
    const role = (metadata.role as string | undefined) ?? 'patient';

    if (role !== 'patient') {
      await supabase.auth.signOut();
      Alert.alert(
        'Staff Portal Access Required',
        'This mobile app is exclusively for clinic patients. Staff members (Doctors, Nurses, Receptionists, Admins) must log in through the M-Care Web Dashboard.'
      );
      setUser(null);
      setSession(null);
      setProfile(null);
      setPatient(null);
      return null;
    }

    const profilePayload = {
      id: authUser.id,
      role,
      full_name:
        (metadata.full_name as string | undefined) ??
        authUser.email?.split('@')[0] ??
        'Patient',
      phone: (metadata.phone as string | undefined) ?? null,
      date_of_birth: (metadata.date_of_birth as string | undefined) ?? null,
      address: (metadata.address as string | undefined) ?? null,
    };

    const { data: createdProfile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (profileError) {
      console.warn('Profile sync failed:', profileError.message);
      return null;
    }

    const upsertedProfile = createdProfile ?? profilePayload;
    setProfile(upsertedProfile as Profile);

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .upsert(
        {
          profile_id: authUser.id,
          emergency_contact_name: (metadata.emergency_contact_name as string | undefined) ?? null,
          emergency_contact_phone: (metadata.emergency_contact_phone as string | undefined) ?? null,
          blood_type: (metadata.blood_type as string | undefined) ?? null,
          allergies: (metadata.allergies as string | undefined) ?? null,
          obstetric_history: (metadata.obstetric_history as string | undefined) ?? null,
          privacy_consent: (metadata.privacy_consent as boolean | undefined) ?? true,
        },
        { onConflict: 'profile_id' }
      )
      .select('*')
      .maybeSingle();

    if (patientError && patientError.code !== 'PGRST116') {
      console.warn('Patient sync failed:', patientError.message);
    }

    if (patientData) {
      setPatient(patientData as Patient);
    }

    return upsertedProfile as Profile;
  };

  const fetchProfileAndPatient = async (userId: string) => {
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('Profile fetch note:', profileErr.message);
      }

      if (!profileData) {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          return ensureProfileRecord(authUser.user);
        }
        return null;
      }

      // Check role boundary: Mobile app is STRICTLY for patients
      if (profileData.role !== 'patient') {
        await supabase.auth.signOut();
        Alert.alert(
          'Staff Portal Access Required',
          'This mobile app is exclusively for clinic patients. Staff members (Doctors, Nurses, Receptionists, Admins) must log in through the M-Care Web Dashboard.'
        );
        setUser(null);
        setSession(null);
        setProfile(null);
        setPatient(null);
        return null;
      }

      setProfile(profileData as Profile);

      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();

      if (patientData) {
        setPatient(patientData as Patient);
      } else {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          await ensureProfileRecord(authUser.user);
        }
      }

      return profileData;
    } catch (err) {
      console.error('Error fetching profile/patient:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndPatient(user.id);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (initialSession?.user) {
          const valid = await fetchProfileAndPatient(initialSession.user.id);
          if (valid) {
            setSession(initialSession);
            setUser(initialSession.user);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchProfileAndPatient(newSession.user.id);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setPatient(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        const valid = await fetchProfileAndPatient(data.user.id);
        if (!valid) {
          throw new Error('This account does not have patient access on mobile.');
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      Alert.alert('Sign In Failed', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithOtp = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;
      Alert.alert(
        'OTP Code Sent',
        'A 6-digit one-time verification code has been sent to your email.'
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send OTP code. Please try again.';
      Alert.alert('OTP Request Failed', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        const valid = await fetchProfileAndPatient(data.user.id);
        if (!valid) {
          throw new Error('This account does not have patient access on mobile.');
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid or expired OTP code.';
      Alert.alert('Verification Failed', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (params: RegisterPatientParams) => {
    setLoading(true);
    try {
      if (!params.privacyConsent) {
        throw new Error(
          'In compliance with the Philippine Data Privacy Act of 2012, you must consent to personal health data processing.'
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            date_of_birth: params.dateOfBirth || null,
            address: params.address?.trim() || null,
            emergency_contact_name: params.emergencyContactName?.trim() || null,
            emergency_contact_phone: params.emergencyContactPhone?.trim() || null,
            blood_type: params.bloodType || null,
            allergies: params.allergies?.trim() || null,
            obstetric_history: params.obstetricHistory?.trim() || null,
            privacy_consent: true,
            role: 'patient',
          },
        },
      });

      if (error) throw error;

      Alert.alert(
        'Account Registered!',
        data.session
          ? 'Welcome to M-Care! You are now logged in.'
          : 'Please check your email to verify your account, or sign in now if email auto-confirm is enabled.'
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (error) throw error;
      Alert.alert(
        'Password Reset Email Sent',
        'Instructions to reset your password have been sent to your email.'
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to send password reset email.';
      Alert.alert('Error', message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setPatient(null);
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        patient,
        loading,
        signIn,
        signInWithOtp,
        verifyOtp,
        signUp,
        resetPassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
