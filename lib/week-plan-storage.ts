import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig } from '@/constants/config';
import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import type { WeekPlannedOutfit } from '@/types/style';

const STORAGE_KEY = 'style-assistant/week-plan';

function buildStableSketchUri(requestId: string, tier: LookRecommendation['tier']) {
  if (appConfig.useMockServices || !appConfig.apiBaseUrl) {
    return null;
  }

  return `${appConfig.apiBaseUrl}/outfits/${requestId}/sketch/${tier}`;
}

function normalizeWeekPlannedOutfit(item: WeekPlannedOutfit): WeekPlannedOutfit {
  return {
    ...item,
    recommendation: {
      ...item.recommendation,
      sketchImageUrl:
        item.recommendation.sketchStatus === 'ready'
          ? buildStableSketchUri(item.requestId, item.recommendation.tier)
          : item.recommendation.sketchImageUrl ?? null,
    },
  };
}

export function getNextSevenDays() {
  const baseDate = new Date();
  const days = [];

  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + offset);

    days.push({
      dayKey: date.toISOString().slice(0, 10),
      dayLabel: date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    });
  }

  return days;
}

export async function loadWeekPlan(): Promise<WeekPlannedOutfit[]> {
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
      .filter(
        (item): item is WeekPlannedOutfit =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.dayKey === 'string' &&
          typeof item.dayLabel === 'string' &&
          typeof item.requestId === 'string' &&
          typeof item.assignedAt === 'string' &&
          typeof item.input === 'object' &&
          item.input !== null &&
          typeof item.recommendation === 'object' &&
          item.recommendation !== null
      )
      .map(normalizeWeekPlannedOutfit)
      .sort((left, right) => left.dayKey.localeCompare(right.dayKey));
  } catch {
    return [];
  }
}

export async function assignOutfitToWeekDay(
  dayKey: string,
  dayLabel: string,
  input: CreateLookInput,
  recommendation: LookRecommendation,
  requestId: string
) {
  const currentItems = await loadWeekPlan();
  const nextItem = normalizeWeekPlannedOutfit({
    dayKey,
    dayLabel,
    requestId,
    assignedAt: new Date().toISOString(),
    input,
    recommendation,
  });
  const nextItems = [nextItem, ...currentItems.filter((item) => item.dayKey !== dayKey)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  return nextItem;
}

export async function removeWeekPlan(dayKey: string) {
  const currentItems = await loadWeekPlan();
  const nextItems = currentItems.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  return nextItems;
}
