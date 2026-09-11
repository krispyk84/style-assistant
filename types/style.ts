import type { CreateLookInput, LookRecommendation } from '@/types/look-request';

export type OutfitTierKey = 'essential' | 'refined' | 'editorial';

export type AnchorItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  occasion: string;
  description: string;
};

export type SavedOutfit = {
  id: string;
  requestId: string;
  savedAt: string;
  input: CreateLookInput;
  recommendation: LookRecommendation;
};

export type WeekPlannedOutfit = {
  dayKey: string;
  dayLabel: string;
  requestId: string;
  assignedAt: string;
  input: CreateLookInput;
  recommendation: LookRecommendation;
};
