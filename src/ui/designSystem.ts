/**
 * XamLeydi v2.0 Design System
 * Modern Material Design 3 / iOS HIG inspired design tokens
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const colors = {
  // Primary Colors
  primary: {
    forest: '#2563EB',      // Primary Blue - Professional, trust, modern
    forestDark: '#1D4ED8',  // Darker variant for hover/pressed
    forestLight: '#3B82F6', // Lighter variant
  },
  
  // Secondary/Accent Colors
  accent: {
    gold: '#D4AF37',        // Subtle Ocher - Action, importance
    goldLight: '#E4C04B',   // Lighter variant
    goldDark: '#B8942F',    // Darker variant
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    successLight: '#6EE7B7',
    successBg: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FCD34D',
    warningBg: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FCA5A5',
    errorBg: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#93C5FD',
    infoBg: '#DBEAFE',
  },
  
  // Neutral Grays - Light Mode
  light: {
    background: '#F5F7FA',
    backgroundAlt: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    divider: '#E5E7EB',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    disabled: '#D1D5DB',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Neutral Grays - Dark Mode
  dark: {
    background: '#111827',
    backgroundAlt: '#1F2937',
    surface: '#1F2937',
    surfaceElevated: '#374151',
    border: '#374151',
    borderLight: '#4B5563',
    divider: '#374151',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    disabled: '#4B5563',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  
  fontSize: {
    // Page Titles
    h1: 28,
    // Section Headings
    h2: 22,
    // Subsection Titles
    h3: 18,
    // Card Titles
    h4: 16,
    // Body Text
    body: 14,
    // Small Text / Labels
    small: 12,
    // Tiny Text
    tiny: 10,
    // Button Text
    button: 14,
  },
  
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// =============================================================================
// SPACING SYSTEM (4px baseline grid)
// =============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

// Function-style spacing (multiplier of 4)
export const space = (multiplier: number): number => Math.round(4 * multiplier);

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  // Aliases for components
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
};

// =============================================================================
// ANIMATION DURATIONS
// =============================================================================

export const animation = {
  fast: 100,
  normal: 200,
  slow: 300,
  verySlow: 500,
  // Nested duration namespace for component compatibility
  duration: {
    fast: 100,
    normal: 200,
    slow: 300,
    verySlow: 500,
  },
};

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

export const layout = {
  // Bottom Navigation
  bottomNavHeight: 56,
  // Header
  headerHeight: 56,
  // Touch targets
  minTouchTarget: 48,
  // Card dimensions
  cardPadding: 16,
  cardRadius: 12,
  // Button dimensions
  buttonHeight: 48,
  buttonPaddingH: 24,
  buttonPaddingV: 12,
  buttonRadius: 8,
  // Input dimensions
  inputHeight: 48,
  inputPaddingH: 16,
  inputRadius: 8,
  // Badge dimensions
  badgePaddingH: 12,
  badgePaddingV: 4,
  badgeRadius: 16,
  // FAB dimensions
  fabSize: 56,
  fabRadius: 28,
  // Quick action button
  quickActionSize: 56,
  quickActionRadius: 28,
};

// =============================================================================
// THEME OBJECTS (Light & Dark)
// =============================================================================

export interface DesignTheme {
  isDark: boolean;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
    accentLight: string;
    accentDark: string;
    success: string;
    successLight: string;
    successBg: string;
    warning: string;
    warningLight: string;
    warningBg: string;
    danger: string;
    dangerLight: string;
    dangerBg: string;
    error: string;
    info: string;
    infoLight: string;
    infoBg: string;
    background: string;
    backgroundAlt: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    borderLight: string;
    borderStrong: string;
    divider: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    disabled: string;
    overlay: string;
    // Tab bar
    tabBar: string;
    tabBarBorder: string;
    tabBarActive: string;
    tabBarInactive: string;
    // Status badge colors
    statusValidated: string;
    statusValidatedBg: string;
    statusPending: string;
    statusPendingBg: string;
    statusRejected: string;
    statusRejectedBg: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  animation: typeof animation;
  layout: typeof layout;
}

export const lightTheme: DesignTheme = {
  isDark: false,
  colors: {
    primary: colors.primary.forest,
    primaryDark: colors.primary.forestDark,
    primaryLight: '#E8F5E9', // Light green tint for backgrounds
    accent: colors.accent.gold,
    accentLight: colors.accent.goldLight,
    accentDark: colors.accent.goldDark,
    success: colors.semantic.success,
    successLight: colors.semantic.successLight,
    successBg: colors.semantic.successBg,
    warning: colors.semantic.warning,
    warningLight: colors.semantic.warningLight,
    warningBg: colors.semantic.warningBg,
    danger: colors.semantic.error,
    dangerLight: colors.semantic.errorLight,
    dangerBg: colors.semantic.errorBg,
    error: colors.semantic.error,
    info: colors.semantic.info,
    infoLight: colors.semantic.infoLight,
    infoBg: colors.semantic.infoBg,
    background: colors.light.background,
    backgroundAlt: colors.light.backgroundAlt,
    surface: colors.light.surface,
    surfaceElevated: colors.light.surfaceElevated,
    border: colors.light.border,
    borderLight: colors.light.borderLight,
    borderStrong: '#CBD5E1',
    divider: colors.light.divider,
    text: colors.light.text,
    textSecondary: colors.light.textSecondary,
    textTertiary: colors.light.textTertiary,
    disabled: colors.light.disabled,
    overlay: colors.light.overlay,
    tabBar: colors.light.surface,
    tabBarBorder: colors.light.border,
    tabBarActive: colors.primary.forest,
    tabBarInactive: colors.light.textTertiary,
    statusValidated: '#065F46',
    statusValidatedBg: '#D1FAE5',
    statusPending: '#92400E',
    statusPendingBg: '#FEF3C7',
    statusRejected: '#991B1B',
    statusRejectedBg: '#FEE2E2',
  },
  typography,
  spacing,
  radii,
  shadows,
  animation,
  layout,
};

export const darkTheme: DesignTheme = {
  isDark: true,
  colors: {
    primary: '#4ADE80',  // Brighter green for dark mode visibility
    primaryDark: '#22C55E',
    primaryLight: 'rgba(34, 197, 94, 0.15)', // Translucent green for backgrounds
    accent: colors.accent.goldLight,
    accentLight: colors.accent.gold,
    accentDark: colors.accent.goldDark,
    success: '#4ADE80',
    successLight: '#86EFAC',
    successBg: 'rgba(34, 197, 94, 0.2)',
    warning: '#FBBF24',
    warningLight: '#FCD34D',
    warningBg: 'rgba(245, 158, 11, 0.2)',
    danger: '#F87171',
    dangerLight: '#FCA5A5',
    dangerBg: 'rgba(239, 68, 68, 0.2)',
    error: '#F87171',
    info: '#60A5FA',
    infoLight: '#93C5FD',
    infoBg: 'rgba(59, 130, 246, 0.2)',
    background: colors.dark.background,
    backgroundAlt: colors.dark.backgroundAlt,
    surface: colors.dark.surface,
    surfaceElevated: colors.dark.surfaceElevated,
    border: colors.dark.border,
    borderLight: colors.dark.borderLight,
    borderStrong: '#6B7280',
    divider: colors.dark.divider,
    text: colors.dark.text,
    textSecondary: colors.dark.textSecondary,
    textTertiary: colors.dark.textTertiary,
    disabled: colors.dark.disabled,
    overlay: colors.dark.overlay,
    tabBar: colors.dark.surface,
    tabBarBorder: colors.dark.border,
    tabBarActive: '#4ADE80',
    tabBarInactive: colors.dark.textTertiary,
    statusValidated: '#86EFAC',
    statusValidatedBg: 'rgba(34, 197, 94, 0.2)',
    statusPending: '#FCD34D',
    statusPendingBg: 'rgba(245, 158, 11, 0.2)',
    statusRejected: '#FCA5A5',
    statusRejectedBg: 'rgba(239, 68, 68, 0.2)',
  },
  typography,
  spacing,
  radii,
  shadows,
  animation,
  layout,
};

// Default export for convenience
export default { lightTheme, darkTheme, colors, typography, spacing, radii, shadows, animation, layout };
