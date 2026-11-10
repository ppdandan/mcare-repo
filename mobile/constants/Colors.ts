/**
 * M-Care Color Palette
 *
 * Primary pink color chosen for OB-GYN healthcare branding.
 * Secondary purple provides complementary accent.
 * All colors follow WCAG accessibility guidelines for contrast.
 */

const Colors = {
  // ── Brand Colors ──────────────────────────────────────────
  primary: '#E91E8C',        // Pink — main brand color
  primaryLight: '#F472B6',   // Light pink — hover/active states
  primaryDark: '#BE185D',    // Dark pink — pressed states
  secondary: '#7C3AED',     // Purple — accent color
  secondaryLight: '#A78BFA', // Light purple — accent hover
  secondaryDark: '#5B21B6',  // Dark purple — accent pressed

  // ── Background Colors ────────────────────────────────────
  background: '#FFFFFF',     // White — main background
  surface: '#F9FAFB',       // Off-white — card backgrounds
  surfaceAlt: '#F3F4F6',    // Light gray — alternate surface

  // ── Text Colors ───────────────────────────────────────────
  text: '#1F2937',           // Dark gray — primary text
  textSecondary: '#6B7280',  // Medium gray — secondary text
  textLight: '#9CA3AF',      // Light gray — placeholder text
  textOnPrimary: '#FFFFFF',  // White — text on primary color

  // ── Status Colors ─────────────────────────────────────────
  success: '#10B981',        // Green — success states
  warning: '#F59E0B',        // Amber — warning states
  error: '#EF4444',          // Red — error states
  info: '#3B82F6',           // Blue — info states

  // ── Border & Divider ─────────────────────────────────────
  border: '#E5E7EB',         // Light gray — borders
  borderLight: '#F3F4F6',    // Very light gray — subtle borders
  divider: '#E5E7EB',        // Divider lines

  // ── Appointment Status Colors ─────────────────────────────
  statusScheduled: '#3B82F6',   // Blue
  statusConfirmed: '#10B981',   // Green
  statusCompleted: '#6B7280',   // Gray
  statusCancelled: '#EF4444',   // Red
  statusNoShow: '#F59E0B',      // Amber
} as const;

export default Colors;
