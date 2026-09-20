import type { ApiResponse } from '@/types/api';
import type { Fragrance, ProfileFragranceResult, UserFragrance } from '@/types/fragrance';
import type {
  AddUserFragrancePayload,
  CreateManualFragrancePayload,
  FragrancesService,
  FragranceSketchPreviewPayload,
  FragranceSketchPreviewResponse,
  FragranceSketchStatusResponse,
  ProfileFragrancePayload,
  UpdateUserFragrancePayload,
} from './fragrances-service';

// In-memory only — mock mode has no backend to persist against, mirroring
// mock-closet-service.ts's AI-unavailable stubs for the AI-dependent
// endpoints (profiling, sketch generation) while still letting the manual
// add/list/update/remove flow work end-to-end for local UI development.
let mockCatalog: Fragrance[] = [];
let mockOwned: UserFragrance[] = [];
let mockIdCounter = 0;

function nextId(prefix: string): string {
  mockIdCounter += 1;
  return `mock-${prefix}-${mockIdCounter}`;
}

export const mockFragrancesService: FragrancesService = {
  async searchCatalog(query: string): Promise<ApiResponse<{ fragrances: Fragrance[] }>> {
    const q = query.toLowerCase();
    return {
      success: true,
      data: { fragrances: mockCatalog.filter((f) => f.brand.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)) },
      error: null,
    };
  },

  async profileFragrance(_payload: ProfileFragrancePayload): Promise<ApiResponse<ProfileFragranceResult>> {
    return { success: false, data: null, error: { code: 'UNAVAILABLE', message: 'Fragrance identification is not available right now.' } };
  },

  async createManualFragrance(payload: CreateManualFragrancePayload): Promise<ApiResponse<Fragrance>> {
    const existing = mockCatalog.find(
      (f) => f.brand.toLowerCase() === payload.brand.toLowerCase() && f.name.toLowerCase() === payload.name.toLowerCase(),
    );
    if (existing) return { success: true, data: existing, error: null };

    const fragrance: Fragrance = {
      id: nextId('fragrance'),
      brand: payload.brand,
      name: payload.name,
      concentration: payload.concentration ?? null,
      topNotes: null,
      middleNotes: null,
      baseNotes: null,
      mainAccords: null,
      primaryVibe: payload.primaryVibe ?? null,
      secondaryVibes: payload.secondaryVibes ?? null,
      seasonality: payload.seasonality ?? null,
      dayNight: null,
      formality: payload.formality ?? null,
      profileSource: 'manual',
      profileConfidence: null,
    };
    mockCatalog = [fragrance, ...mockCatalog];
    return { success: true, data: fragrance, error: null };
  },

  async startSketchPreview(_payload: FragranceSketchPreviewPayload): Promise<ApiResponse<FragranceSketchPreviewResponse>> {
    return { success: false, data: null, error: { code: 'UNAVAILABLE', message: 'Sketch generation is not available right now.' } };
  },

  async getSketchPreview(_jobId: string): Promise<ApiResponse<FragranceSketchStatusResponse>> {
    return { success: true, data: { sketchStatus: 'failed', sketchImageUrl: null }, error: null };
  },

  async addToCloset(payload: AddUserFragrancePayload): Promise<ApiResponse<UserFragrance>> {
    const fragrance = mockCatalog.find((f) => f.id === payload.fragranceId);
    if (!fragrance) return { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Fragrance not found in catalog.' } };
    if (mockOwned.some((o) => o.fragranceId === payload.fragranceId)) {
      return { success: false, data: null, error: { code: 'ALREADY_OWNED', message: 'This fragrance is already in your closet.' } };
    }

    const owned: UserFragrance = {
      id: nextId('user-fragrance'),
      fragranceId: fragrance.id,
      fragrance,
      originalImageUrl: payload.originalImageUrl ?? null,
      bottleSketchUrl: payload.bottleSketchUrl ?? null,
      bottleSketchStatus: payload.bottleSketchUrl ? 'ready' : 'not_started',
      isSignature: payload.isSignature ?? false,
      currentVolumeMl: payload.currentVolumeMl ?? null,
      userNotes: payload.userNotes ?? null,
      profileOverrides: payload.profileOverrides ?? null,
      createdAt: new Date().toISOString(),
    };
    mockOwned = [owned, ...mockOwned];
    return { success: true, data: owned, error: null };
  },

  async listUserFragrances(): Promise<ApiResponse<{ fragrances: UserFragrance[] }>> {
    return { success: true, data: { fragrances: mockOwned }, error: null };
  },

  async updateUserFragrance(id: string, payload: UpdateUserFragrancePayload): Promise<ApiResponse<UserFragrance>> {
    const existing = mockOwned.find((o) => o.id === id);
    if (!existing) return { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Fragrance not found in your closet.' } };
    const updated: UserFragrance = {
      ...existing,
      isSignature: payload.isSignature ?? existing.isSignature,
      currentVolumeMl: payload.currentVolumeMl !== undefined ? payload.currentVolumeMl : existing.currentVolumeMl,
      userNotes: payload.userNotes ?? existing.userNotes,
      profileOverrides: payload.profileOverrides ?? existing.profileOverrides,
    };
    mockOwned = mockOwned.map((o) => (o.id === id ? updated : o));
    return { success: true, data: updated, error: null };
  },

  async removeUserFragrance(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    mockOwned = mockOwned.filter((o) => o.id !== id);
    return { success: true, data: { deleted: true }, error: null };
  },
};
