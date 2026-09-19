import type { ApiResponse } from '@/types/api';
import type { Fragrance, ProfileFragranceResult, UserFragrance } from '@/types/fragrance';

export type ProfileFragrancePayload = {
  brand?: string;
  name?: string;
  concentration?: string;
  imageUrl?: string;
};

export type CreateManualFragrancePayload = {
  brand: string;
  name: string;
  concentration?: string;
  primaryVibe?: string;
  secondaryVibes?: string[];
  seasonality?: Record<string, number>;
  formality?: Record<string, number>;
};

export type FragranceSketchPreviewPayload = {
  brand: string;
  name: string;
  concentration?: string;
  imageUrl?: string;
};

export type AddUserFragrancePayload = {
  fragranceId: string;
  originalImageUrl?: string;
  bottleSketchUrl?: string;
  isSignature?: boolean;
  currentVolumeMl?: number | null;
  userNotes?: string;
  /** User corrections made before first save — never mutates the shared catalog row. */
  profileOverrides?: Record<string, unknown>;
};

export type UpdateUserFragrancePayload = {
  isSignature?: boolean;
  currentVolumeMl?: number | null;
  userNotes?: string;
  profileOverrides?: Record<string, unknown>;
};

export type FragranceSketchPreviewResponse = {
  jobId: string;
};

export type FragranceSketchStatusResponse = {
  sketchStatus: 'pending' | 'ready' | 'failed';
  sketchImageUrl: string | null;
};

export type FragrancesService = {
  searchCatalog: (query: string) => Promise<ApiResponse<{ fragrances: Fragrance[] }>>;
  profileFragrance: (payload: ProfileFragrancePayload) => Promise<ApiResponse<ProfileFragranceResult>>;
  /** Manual fallback — no AI call — for when recognition failed or the user chose manual entry. */
  createManualFragrance: (payload: CreateManualFragrancePayload) => Promise<ApiResponse<Fragrance>>;
  startSketchPreview: (payload: FragranceSketchPreviewPayload) => Promise<ApiResponse<FragranceSketchPreviewResponse>>;
  getSketchPreview: (jobId: string) => Promise<ApiResponse<FragranceSketchStatusResponse>>;
  addToCloset: (payload: AddUserFragrancePayload) => Promise<ApiResponse<UserFragrance>>;
  listUserFragrances: () => Promise<ApiResponse<{ fragrances: UserFragrance[] }>>;
  updateUserFragrance: (id: string, payload: UpdateUserFragrancePayload) => Promise<ApiResponse<UserFragrance>>;
  removeUserFragrance: (id: string) => Promise<ApiResponse<{ deleted: boolean }>>;
};
