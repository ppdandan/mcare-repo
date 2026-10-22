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

  const fetchProfileAndPatient = async (userId: string) => {
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr || !profileData) {
        console.warn('Profile fetch note:', profileErr?.message);
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
        .single();

      if (patientData) {
        setPatient(patientData as Patient);
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
