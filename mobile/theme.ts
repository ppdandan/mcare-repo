import { designTokens } from '@m-care/shared';

export const theme = designTokens;
export const spacing = designTokens.spacing;
export const typography = designTokens.typography;
export const radius = designTokens.radius;
export const size = designTokens.size;

/** Mobile-friendly names mapped directly to the shared website and mobile palette. */
export const colors = {
  primary: designTokens.color.brand,
  primaryLight: designTokens.color.brandSoft,
  primaryDark: designTokens.color.brandStrong,
  secondary: designTokens.color.brandMid,
  secondaryLight: designTokens.color.brandSoft,
  secondaryDark: designTokens.color.brandStrong,
  background: designTokens.color.surface,
  surface: designTokens.color.canvas,
  surfaceAlt: designTokens.color.brandSoft,
  text: designTokens.color.text,
  textSecondary: designTokens.color.textMuted,
  textLight: designTokens.color.textPlaceholder,
  textOnPrimary: designTokens.color.onBrand,
  success: designTokens.color.success,
  warning: designTokens.color.warning,
  error: designTokens.color.error,
  info: designTokens.color.info,
  border: designTokens.color.border,
  borderLight: designTokens.color.divider,
  divider: designTokens.color.divider,
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
  shadow: designTokens.color.shadow,
} as const;
