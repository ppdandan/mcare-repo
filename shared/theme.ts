/** Shared visual tokens used by the Expo app and patient website. */
export const designTokens = {
  color: {
    // Rose shades sampled from logo.png. The dark brand shade meets WCAG AA on white.
    brand: '#7A314F',
    brandStrong: '#642640',
    brandMid: '#994B68',
    brandMark: '#B65B7E',
    brandSoft: '#F4E9EE',
    brandWash: '#FBF7F9',
    surface: '#FFFFFF',
    canvas: '#FBF8F9',
    text: '#262126',
    textMuted: '#5E575D',
    textPlaceholder: '#6B6268',
    border: '#DED5D9',
    divider: '#E9E2E5',
    success: '#176B4A',
    successSoft: '#E8F4EE',
    warning: '#805500',
    warningSoft: '#FFF4D9',
    error: '#9F3030',
    errorSoft: '#FCECEC',
    info: '#285786',
    infoSoft: '#EAF1F8',
    onBrand: '#FFFFFF',
    shadow: '#33232B',
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20,
    '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64,
  },
  typography: {
    caption: { fontSize: 12, lineHeight: 18 },
    small: { fontSize: 14, lineHeight: 21 },
    body: { fontSize: 16, lineHeight: 24 },
    subhead: { fontSize: 18, lineHeight: 26 },
    title: { fontSize: 20, lineHeight: 28 },
    heading: { fontSize: 24, lineHeight: 32 },
    display: { fontSize: 30, lineHeight: 38 },
    largeTitle: { fontSize: 34, lineHeight: 42 },
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  size: { controlHeight: 44, tapTarget: 44, icon: 20 },
} as const;

export const theme = designTokens;
export const spacing = designTokens.spacing;
export const typography = designTokens.typography;
export const radius = designTokens.radius;
