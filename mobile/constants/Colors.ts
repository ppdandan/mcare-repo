/**
 * M-Care Color Palette
 *
 * Primary pink color chosen for OB-GYN healthcare branding.
 * Secondary purple provides complementary accent.
 * All colors follow WCAG accessibility guidelines for contrast.
 */

import { designTokens } from '@m-care/shared';

const Colors = {
  // ── Brand Colors ──────────────────────────────────────────
  primary: designTokens.color.brand,
  primaryLight: designTokens.color.brandSoft,
  primaryDark: designTokens.color.brandStrong,
  secondary: designTokens.color.brandMid,
  secondaryLight: designTokens.color.brandSoft,
  secondaryDark: designTokens.color.brandStrong,

  // ── Background Colors ────────────────────────────────────
  background: designTokens.color.surface,
  surface: designTokens.color.canvas,
  surfaceAlt: designTokens.color.brandSoft,

  // ── Text Colors ───────────────────────────────────────────
  text: designTokens.color.text,
  textSecondary: designTokens.color.textMuted,
  textLight: designTokens.color.textPlaceholder,
  textOnPrimary: designTokens.color.onBrand,

  // ── Status Colors ─────────────────────────────────────────
  success: designTokens.color.success,
  warning: designTokens.color.warning,
  error: designTokens.color.error,
  info: designTokens.color.info,

  // ── Border & Divider ─────────────────────────────────────
  border: designTokens.color.border,
  borderLight: designTokens.color.divider,
  divider: designTokens.color.divider,

  // ── Appointment Status Colors ─────────────────────────────
  statusScheduled: designTokens.color.info,
  statusConfirmed: designTokens.color.success,
  statusCompleted: designTokens.color.textMuted,
  statusCancelled: designTokens.color.error,
  statusNoShow: designTokens.color.warning,
  brandSoft: designTokens.color.brandSoft,
  brandWash: designTokens.color.brandWash,
  successBackground: designTokens.color.successSoft,
  warningBackground: designTokens.color.warningSoft,
  errorBackground: designTokens.color.errorSoft,
  infoBackground: designTokens.color.infoSoft,
  shadow: '#33232B',
} as const;

export default Colors;
