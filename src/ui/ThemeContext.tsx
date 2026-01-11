/**
 * XamLeydi v2.0 - Theme Context
 * Provides design system theme throughout the app
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { DesignTheme, lightTheme, darkTheme } from './designSystem';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: DesignTheme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  isDark: false,
  setMode: () => undefined,
  toggleMode: () => undefined,
});

const resolveTheme = (mode: ThemeMode, systemScheme: ColorSchemeName | null): DesignTheme => {
  if (mode === 'system') {
    return systemScheme === 'dark' ? darkTheme : lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
};

interface ThemeProviderProps {
  initialMode?: ThemeMode;
  children: React.ReactNode;
}

export const DesignThemeProvider: React.FC<ThemeProviderProps> = ({
  initialMode = 'light',
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    const listener = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      setSystemScheme(colorScheme);
    };
    const subscription = Appearance.addChangeListener(listener);
    return () => subscription.remove();
  }, []);

  const theme = useMemo(() => resolveTheme(mode, systemScheme), [mode, systemScheme]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      isDark: theme.isDark,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useDesignTheme = () => useContext(ThemeContext);

export const availableThemeModes: ThemeMode[] = ['light', 'dark', 'system'];

export default { DesignThemeProvider, useDesignTheme, availableThemeModes };
