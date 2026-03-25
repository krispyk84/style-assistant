import type { ClosetItem } from '@/types/closet';
import type { CreateLookInput, LookRequestResponse } from '@/types/look-request';
import type { LocalImageAsset, UploadedImageAsset, UploadedImageCategory } from '@/types/media';
import type { PersistedSession, Profile } from '@/types/profile';
import type { OutfitResult } from '@/types/style';

export type ApiError = {
  code: string;
  message: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
};

export type ProfileUpsertRequest = {
  profile: Profile;
  onboardingCompleted: boolean;
};

export type ProfileSessionResponse = PersistedSession;

export type GenerateOutfitsRequest = CreateLookInput & {
  requestId: string;
  variantMap?: Partial<Record<CreateLookInput['selectedTiers'][number], number>>;
};

export type GenerateOutfitsResponse = LookRequestResponse;

export type AnalysisVerdict = 'Works great' | 'Works okay' | "Doesn't work";

export type AnalysisResponse = {
  id?: string;
  verdict: AnalysisVerdict;
  explanation?: string;
  concerns?: string[];
  suggestedAlternatives?: string[];
  strengths?: string[];
  issues?: string[];
  recommendedAdjustments?: string[];
  stylistNotes: string[];
  suggestedChanges: string[];
  createdAt?: string;
};

export type OutfitHistoryResponse = {
  items: OutfitResult[];
};

export type CompatibilityCheckRequest = {
  image: LocalImageAsset;
  uploadedImage?: UploadedImageAsset | null;
  requestId?: string;
  tier?: string;
  outfitTitle?: string;
  anchorItemDescription?: string;
  pieceName?: string;
};

export type CompatibilityCheckResponse = AnalysisResponse;

export type SelfieReviewRequest = {
  image: LocalImageAsset;
  uploadedImage?: UploadedImageAsset | null;
  requestId?: string;
  tier?: string;
  outfitTitle?: string;
  anchorItemDescription?: string;
};

export type UploadImageResponse = UploadedImageAsset;

export type DeleteUploadResponse = {
  deleted: boolean;
};

export type SelfieReviewResponse = AnalysisResponse;

export type AnalyzeClosetItemRequest = {
  uploadedImageId?: string;
  uploadedImageUrl?: string;
  description?: string;
};

export type AnalyzeClosetItemResponse = {
  title: string;
  category: string;
};

export type SaveClosetItemRequest = {
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageId?: string;
  uploadedImageUrl?: string;
};

export type GetClosetItemsResponse = {
  items: ClosetItem[];
};
