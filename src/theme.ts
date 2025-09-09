const colors = {
  primary: '#A02020', // deep red for nav/header and buttons
  accent: '#5CB85C', // green for primary actions
  secondary: '#0072BC', // blue for highlights
  background: '#F7F7F7',
  surface: '#FFFFFF',
  muted: '#F2F4F7',
  text: '#222',
  subtext: '#6B7280',
  cardShadow: 'rgba(0,0,0,0.08)',
};

// base spacing unit used by theme.spacing(n)
const BASE_SPACING = 8;

// named exports kept for modules that import them directly
export const palette = {
  primary: colors.primary,
  primaryDark: '#801818',
  accent: colors.accent,
  background: colors.background,
  surface: colors.surface,
  muted: '#9e9e9e',
  danger: '#e53935',
};

// Provide spacing as both a function (preferred by the codebase) and a small object for convenience
export const spacing = (multiplier: number) => Math.round(BASE_SPACING * multiplier);
export const spacingValues = {
  xs: BASE_SPACING * 0.5,
  sm: BASE_SPACING,
  md: BASE_SPACING * 2,
  lg: BASE_SPACING * 3,
  xl: BASE_SPACING * 4,
};

export const typography = {
  h1: 20,
  h2: 18,
  h3: 16,
  caption: 12,
  body: 14,
};

export const metrics = {
  borderRadius: 10,
  cardElevation: 4,
};

const radii = {
  sm: 8,
  md: 12,
  lg: 16,
};

const theme = {
  colors: {
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    subtext: colors.subtext,
    muted: colors.muted,
    secondary: colors.secondary,
  },
  appColors: colors,
  // function-style spacing used across the codebase (e.g. theme.spacing(2))
  spacing: spacing,
  spacingValues,
  typography,
  metrics,
  radii,
};

export default theme;
