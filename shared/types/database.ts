import type { UserRole, AppointmentStatus } from './enums';

// ─── 1. Profiles ─────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  created_at: string;
}

// ─── 2. Patients ─────────────────────────────────────────────────────────────
export interface Patient {
  id: string;
  profile_id: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  blood_type: string | null;
  allergies: string | null;
  obstetric_history: string | null;
  privacy_consent: boolean;
  privacy_consent_at: string | null;
}

// ─── 3. Doctors ──────────────────────────────────────────────────────────────
export interface Doctor {
  id: string;
  profile_id: string;
  specialty: string;
  room: string | null;
}

// ─── 4. Services ─────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
}

// ─── 5. Doctor Schedules ─────────────────────────────────────────────────────
export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
}

// ─── 6. Schedule Exceptions ──────────────────────────────────────────────────
export interface ScheduleException {
  id: string;
  doctor_id: string;
  exception_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_blocked: boolean;
}

// ─── 7. Appointments ─────────────────────────────────────────────────────────
export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string;
  start_time: string; // ISO timestamptz
  end_time: string;   // ISO timestamptz
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 8. Medical Records ──────────────────────────────────────────────────────
export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  visit_date: string; // YYYY-MM-DD
  chief_complaint: string | null;
  medical_history: string | null;
  history_of_present_illness: string | null;
  blood_pressure: string | null;
  heart_rate: string | null;
  temperature: string | null;
  weight_kg: number | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 9. Notifications ────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

// ─── 10. Push Tokens ─────────────────────────────────────────────────────────
export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  created_at: string;
  updated_at: string;
}

// ─── 11. Audit Logs ──────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// ─── 12. Inquiries ───────────────────────────────────────────────────────────
export interface Inquiry {
  id: string;
  patient_id: string;
  subject: string;
  message: string;
  status: 'open' | 'replied' | 'closed';
  reply: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Joined View Types ───────────────────────────────────────────────────────

export interface DoctorWithProfile extends Doctor {
  profile: Profile;
}

export interface PatientWithProfile extends Patient {
  profile: Profile;
}

export interface AppointmentWithDetails extends Appointment {
  patient: PatientWithProfile;
  doctor: DoctorWithProfile;
  service: Service;
}

// In-person transaction history recorded after a completed appointment.
export interface Transaction {
  id: string;
  user_id: string;
  appointment_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface TransactionWithAppointment extends Transaction {
  appointment: (Appointment & { service: Service | null }) | null;
}

export interface MedicalRecordWithDetails extends MedicalRecord {
  patient: PatientWithProfile;
  doctor: DoctorWithProfile;
  appointment?: Appointment | null;
}

export interface AvailableSlot {
  slot_start: string;
  slot_end: string;
}
