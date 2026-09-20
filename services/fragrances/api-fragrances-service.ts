import { createApiClient } from '@/lib/api/api-client';
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

export const apiFragrancesService: FragrancesService = {
  async searchCatalog(query: string): Promise<ApiResponse<{ fragrances: Fragrance[] }>> {
    return createApiClient().request<{ fragrances: Fragrance[] }>(`/fragrances/search?q=${encodeURIComponent(query)}`);
  },

  async profileFragrance(payload: ProfileFragrancePayload): Promise<ApiResponse<ProfileFragranceResult>> {
    return createApiClient().request<ProfileFragranceResult>('/fragrances/profile', {
      method: 'POST',
      body: payload,
    });
  },

  async createManualFragrance(payload: CreateManualFragrancePayload): Promise<ApiResponse<Fragrance>> {
    return createApiClient().request<Fragrance>('/fragrances/manual', {
      method: 'POST',
      body: payload,
    });
  },

  async startSketchPreview(payload: FragranceSketchPreviewPayload): Promise<ApiResponse<FragranceSketchPreviewResponse>> {
    return createApiClient().request<FragranceSketchPreviewResponse>('/fragrances/sketch-preview', {
      method: 'POST',
      body: payload,
    });
  },

  async getSketchPreview(jobId: string): Promise<ApiResponse<FragranceSketchStatusResponse>> {
    return createApiClient().request<FragranceSketchStatusResponse>(`/fragrances/sketch-preview/${jobId}`);
  },

  async addToCloset(payload: AddUserFragrancePayload): Promise<ApiResponse<UserFragrance>> {
    return createApiClient().request<UserFragrance>('/closet/fragrances', {
      method: 'POST',
      body: payload,
    });
  },

  async listUserFragrances(): Promise<ApiResponse<{ fragrances: UserFragrance[] }>> {
    return createApiClient().request<{ fragrances: UserFragrance[] }>('/closet/fragrances');
  },

  async updateUserFragrance(id: string, payload: UpdateUserFragrancePayload): Promise<ApiResponse<UserFragrance>> {
    return createApiClient().request<UserFragrance>(`/closet/fragrances/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  async removeUserFragrance(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return createApiClient().request<{ deleted: boolean }>(`/closet/fragrances/${id}`, {
      method: 'DELETE',
    });
  },
};
