/**
 * M-Care App Configuration
 *
 * Central place for app-wide configuration constants.
 * Supabase URL and anon key should be set via environment variables
 * in production. The defaults here are placeholders for development.
 */

import Constants from 'expo-constants';

// ── Supabase Configuration ──────────────────────────────────
// In Expo, variables prefixed with EXPO_PUBLIC_ are automatically inlined.
export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string) ??
  'https://luccnwicirfnmyzgemzj.supabase.co';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y2Nud2ljaXJmbm15emdlbXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTg5NTcsImV4cCI6MjEwODE3NDk1N30.mNPjIm7Jw4l9sD1U7S6fWVvjI1cRRhCU-zdkLM4txIw';

// ── App Info ────────────────────────────────────────────────
export const APP_NAME = 'M-Care';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_DESCRIPTION = 'OB-GYN Patient Care Management';

// ── Pagination ──────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const APPOINTMENTS_PAGE_SIZE = 10;
export const RECORDS_PAGE_SIZE = 10;

// ── Date/Time Formatting ────────────────────────────────────
export const DATE_FORMAT = 'MMM dd, yyyy';          // e.g. "Oct 21, 2026"
export const TIME_FORMAT = 'hh:mm a';               // e.g. "02:30 PM"
export const DATETIME_FORMAT = 'MMM dd, yyyy hh:mm a';

// ── Appointment Constraints ─────────────────────────────────
export const MIN_BOOKING_HOURS_AHEAD = 24;  // Must book at least 24h in advance
export const MAX_BOOKING_DAYS_AHEAD = 90;   // Can book up to 90 days ahead
export const APPOINTMENT_SLOT_MINUTES = 30; // Each slot is 30 minutes

// ── Allowed Roles ───────────────────────────────────────────
// Only patients can use this mobile app
export const ALLOWED_ROLES = ['patient'] as const;
