import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'style-assistant/app-settings';

export type AppSettings = {
  /** 0 = most forgiving (broad color families), 100 = most precise (exact shade match). Default: 50. */
  closetMatchSensitivity: number;
  /** 0 = safe/classic, 100 = very trendy. Default: 50 (balanced). Sent with every outfit generation request. */
  trendiness: number;
  /** Last size entered when saving a closet item — used to pre-fill the Size field. */
  lastUsedSize?: string;
  /** Appearance mode: 'light', 'dark', or 'system'. Default: 'system'. */
  appearanceMode?: 'light' | 'dark' | 'system';
};

const DEFAULT_SETTINGS: AppSettings = {
  closetMatchSensitivity: 50,
  trendiness: 50,
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Merges into the existing stored settings. Pass only the fields you want to
 * change — other fields are preserved. Avoids the previous footgun where
 * `saveAppSettings({ closetMatchSensitivity: x })` would clobber every other
 * field on disk.
 */
export async function saveAppSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await loadAppSettings();
  const next: AppSettings = { ...current, ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
