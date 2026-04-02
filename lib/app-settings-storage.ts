import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'style-assistant/app-settings';

export type AppSettings = {
  /** 0 = most forgiving (broad color families), 100 = most precise (exact shade match). Default: 50. */
  closetMatchSensitivity: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  closetMatchSensitivity: 50,
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

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
