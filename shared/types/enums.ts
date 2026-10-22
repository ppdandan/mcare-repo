// ─── User Roles ──────────────────────────────────────────────────────────────
export type UserRole = 'patient' | 'doctor' | 'nurse' | 'receptionist' | 'admin';

// ─── Appointment Statuses ────────────────────────────────────────────────────
export type AppointmentStatus =
  | 'pending'
  | 'approved'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'no_show';

// ─── Notification Types ──────────────────────────────────────────────────────
export type NotificationType =
  | 'appointment_booked'
  | 'appointment_approved'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  | 'general';

// ─── Days of Week ────────────────────────────────────────────────────────────
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── Exception Types ─────────────────────────────────────────────────────────
export type ExceptionType = 'unavailable' | 'modified';
