import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { darkTheme, lightTheme, Theme, themes } from './theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'light',
  isDark: false,
  setMode: () => undefined,
  toggleMode: () => undefined,
});

const resolveTheme = (mode: ThemeMode, system: ColorSchemeName | null): Theme => {
  if (mode === 'system') {
    return system === 'dark' ? darkTheme : lightTheme;
  }
  const map: Record<Exclude<ThemeMode, 'system'>, Theme> = {
    light: lightTheme,
    dark: darkTheme,
  };
  return map[mode];
};

export const ThemeProvider: React.FC<{ initialMode?: ThemeMode; children: React.ReactNode }> = ({
  initialMode = 'system',
  children,
}) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const listener = ({ colorScheme }: { colorScheme: ColorSchemeName }) => setSystemScheme(colorScheme);
    const subscription = Appearance.addChangeListener(listener);
    return () => subscription.remove();
  }, []);

  const theme = useMemo(() => resolveTheme(mode, systemScheme), [mode, systemScheme]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      isDark: mode === 'dark' || (mode === 'system' && systemScheme === 'dark'),
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme, mode, systemScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext).theme;
export const useThemeMode = () => {
  const { mode, setMode, toggleMode, isDark } = useContext(ThemeContext);
  return { mode, setMode, toggleMode, isDark };
};

export const availableThemeModes: ThemeMode[] = ['light', 'dark', 'system'];
export { themes };
