import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TripOutfitDay } from '@/services/trip-outfits';

const STORAGE_KEY = 'style-assistant/trip-outfits';

export type StoredTripPlan = {
  tripId: string;
  destination: string;
  country: string;
  departureDate?: string;  // YYYY-MM-DD
  returnDate?: string;     // YYYY-MM-DD
  travelParty?: string;
  climateLabel: string;
  avgHighC?: number;
  avgLowC?: number;
  styleVibe: string;
  purposes: string[];
  activities?: string;
  dressCode?: string;
  days: TripOutfitDay[];
  generatedAt: string;
};

export const tripOutfitsStorage = {
  async save(plan: StoredTripPlan): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    const map: Record<string, StoredTripPlan> = raw ? JSON.parse(raw) : {};
    map[plan.tripId] = plan;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  },

  async load(tripId: string): Promise<StoredTripPlan | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (!raw) return null;
    const map: Record<string, StoredTripPlan> = JSON.parse(raw);
    return map[tripId] ?? null;
  },

  async updateDay(tripId: string, updatedDay: TripOutfitDay): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (!raw) return;
    const map: Record<string, StoredTripPlan> = JSON.parse(raw);
    const plan = map[tripId];
    if (!plan) return;
    plan.days = plan.days.map((d) => (d.id === updatedDay.id ? updatedDay : d));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  },

  async appendDay(tripId: string, day: TripOutfitDay): Promise<void> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (!raw) return;
    const map: Record<string, StoredTripPlan> = JSON.parse(raw);
    const plan = map[tripId];
    if (!plan) return;
    // Replace if already exists (idempotent), otherwise append
    const exists = plan.days.some((d) => d.id === day.id);
    plan.days = exists ? plan.days.map((d) => (d.id === day.id ? day : d)) : [...plan.days, day];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  },
};
