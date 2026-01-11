type Gradient = [string, string, ...string[]];

const spacing = (n: number) => 8 * n;

const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
};

const typography = {
  h1: 30,
  h2: 26,
  h3: 22,
  h4: 19,
  body: 16,
  bodySmall: 14,
  caption: 13,
  tiny: 11,
};

const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
};

const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};

type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  background: string;
  backgroundDark: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  divider: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  muted: string;
  disabled: string;
  gradientPrimary: Gradient;
  gradientSuccess: Gradient;
  gradientWarning: Gradient;
  gradientDark: Gradient;
  overlay: string;
  shadowLight: string;
  shadowMedium: string;
  shadowDark: string;
  chipBackground: string;
  tabBar: string;
  tabBarBorder: string;
  fabBackground: string;
  fabIcon: string;
};

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
  animation: typeof animation;
}

export const lightTheme: Theme = {
  colors: {
    primary: '#3C5E3C',
    primaryDark: '#25402A',
    primaryLight: '#58755A',
    accent: '#A97B45',
    accentLight: '#C9A06A',
    success: '#4C7A4C',
    successLight: '#76A176',
    warning: '#B97A1B',
    warningLight: '#D8A34A',
    danger: '#B15A44',
    dangerLight: '#D47C63',
    background: '#F2ECE0',
    backgroundDark: '#E6DECE',
    surface: '#FFFFFF',
    surfaceElevated: '#F9F4EA',
    border: '#DDD1BC',
    borderLight: '#EAE0CC',
    divider: '#CFC3AD',
    text: '#2E372C',
    textSecondary: '#5D665A',
    textTertiary: '#8A937F',
    muted: '#9BA48F',
    disabled: '#C9C1B2',
    gradientPrimary: ['#3C5E3C', '#A97B45'],
    gradientSuccess: ['#4C7A4C', '#2F5330'],
    gradientWarning: ['#B97A1B', '#8C5A11'],
    gradientDark: ['#353226', '#1F1D15'],
    overlay: 'rgba(33, 40, 30, 0.42)',
    shadowLight: 'rgba(60, 94, 60, 0.08)',
    shadowMedium: 'rgba(60, 94, 60, 0.14)',
    shadowDark: 'rgba(60, 94, 60, 0.22)',
    chipBackground: 'rgba(255, 255, 255, 0.24)',
    tabBar: '#FFFFFF',
    tabBarBorder: 'rgba(140, 130, 110, 0.2)',
    fabBackground: '#3C5E3C',
    fabIcon: '#FFFFFF',
  },
  spacing,
  radii,
  typography,
  shadows,
  animation,
};

export const darkTheme: Theme = {
  colors: {
    primary: '#4A7A52',
    primaryDark: '#25422C',
    primaryLight: '#6D9773',
    accent: '#BE8646',
    accentLight: '#D19D61',
    success: '#76A176',
    successLight: '#97BF96',
    warning: '#D18E2F',
    warningLight: '#E8B35B',
    danger: '#D1675A',
    dangerLight: '#E38C7F',
    background: '#111611',
    backgroundDark: '#0A0E0A',
    surface: '#182119',
    surfaceElevated: '#222D23',
    border: '#263327',
    borderLight: '#303E31',
    divider: '#2A382B',
    text: '#E6F0E4',
    textSecondary: '#C2CEBF',
    textTertiary: '#8F9E8C',
    muted: '#7A8876',
    disabled: '#364036',
    gradientPrimary: ['#25422C', '#BE8646'],
    gradientSuccess: ['#4F7B57', '#2E4933'],
    gradientWarning: ['#B97A1B', '#7C4E0F'],
    gradientDark: ['#0A0E0A', '#182119'],
    overlay: 'rgba(10, 14, 10, 0.58)',
    shadowLight: 'rgba(0, 0, 0, 0.28)',
    shadowMedium: 'rgba(0, 0, 0, 0.42)',
    shadowDark: 'rgba(0, 0, 0, 0.58)',
    chipBackground: 'rgba(74, 122, 82, 0.18)',
    tabBar: '#182119',
    tabBarBorder: 'rgba(116, 133, 112, 0.18)',
    fabBackground: '#4A7A52',
    fabIcon: '#0A0E0A',
  },
  spacing,
  radii,
  typography,
  shadows,
  animation,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export default lightTheme;
