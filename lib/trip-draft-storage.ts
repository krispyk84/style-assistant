import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'style-assistant/trip-draft';

type PendingAnchorInput = {
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  rationale?: string;
};

export type TripDraft = {
  draftId: string;
  // Destination
  destinationLabel: string;
  country: string;
  lat?: number;
  lng?: number;
  geonameId?: number;
  // Dates
  departureDate: string;   // YYYY-MM-DD
  returnDate: string;      // YYYY-MM-DD
  numDays: number;         // inclusive day count
  // Trip details
  travelParty: string;
  purposes: string[];
  // Climate
  climateLabel: string;
  avgHighC?: number;
  avgLowC?: number;
  tempBand?: string;
  precipChar?: string;
  packingTag?: string;
  dressSeason?: string;
  // Context
  activities?: string;
  dressCode?: string;
  styleVibe: string;
  // Smart packing
  willSwim: boolean;
  fancyNights: boolean;
  workoutClothes: boolean;
  laundryAccess: 'Yes' | 'No' | 'Unsure';
  shoesCount: string;
  carryOnOnly: boolean;
  specialNeeds?: string;
  // Anchors saved just before progressive generation starts
  pendingAnchors?: PendingAnchorInput[];
  pendingAnchorMode?: 'guided' | 'auto' | 'manual';
  // Meta
  createdAt: string;
};

export const tripDraftStorage = {
  async save(draft: TripDraft): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  },

  async load(): Promise<TripDraft | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (!raw) return null;
    try { return JSON.parse(raw) as TripDraft; } catch { return null; }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
};
