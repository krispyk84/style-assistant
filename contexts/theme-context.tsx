import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { lightTheme, darkTheme, type AppTheme } from '@/constants/themes';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';

export type AppearanceMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: AppTheme;
  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  appearanceMode: 'system',
  setAppearanceMode: async () => {},
});

function resolveTheme(mode: AppearanceMode, systemScheme: ColorSchemeName): AppTheme {
  if (mode === 'dark') return darkTheme;
  if (mode === 'light') return lightTheme;
  return systemScheme === 'dark' ? darkTheme : lightTheme;
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AppearanceMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    void loadAppSettings().then((s) => {
      if (s.appearanceMode) setMode(s.appearanceMode);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const setAppearanceMode = useCallback(async (nextMode: AppearanceMode) => {
    setMode(nextMode);
    const settings = await loadAppSettings();
    await saveAppSettings({ ...settings, appearanceMode: nextMode });
  }, []);

  const theme = resolveTheme(mode, systemScheme);

  return (
    <ThemeContext.Provider value={{ theme, appearanceMode: mode, setAppearanceMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
