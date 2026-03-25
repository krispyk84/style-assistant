import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClosetItem } from '@/types/closet';

const STORAGE_KEY = 'style-assistant/closet-items';

export async function loadClosetItems(): Promise<ClosetItem[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is ClosetItem => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.category === 'string' &&
          typeof item.savedAt === 'string'
        );
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function saveClosetItem(item: ClosetItem): Promise<ClosetItem[]> {
  const items = await loadClosetItems();
  const existing = items.findIndex((i) => i.id === item.id);

  let nextItems: ClosetItem[];
  if (existing >= 0) {
    nextItems = items.map((i) => (i.id === item.id ? item : i));
  } else {
    nextItems = [item, ...items];
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  return nextItems;
}

export async function updateClosetItem(item: ClosetItem): Promise<ClosetItem[]> {
  const items = await loadClosetItems();
  const nextItems = items.map((i) => (i.id === item.id ? item : i));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  return nextItems;
}

export async function deleteClosetItem(id: string): Promise<ClosetItem[]> {
  const items = await loadClosetItems();
  const nextItems = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  return nextItems;
}
