import { createApiClient } from '@/lib/api/api-client';
import type {
  ApiResponse,
  CreateHaircutSessionRequest,
  GenerateHaircutAngleShotsRequest,
  GenerateHaircutGuideRequest,
  HaircutAngleShotsResponse,
  HaircutGuideResponse,
  HaircutSessionResponse,
  SaveHaircutSessionRequest,
  SaveHaircutSessionResponse,
  SavedHaircutSessionsResponse,
} from '@/types/api';
import type { HaircutService } from './haircut-service';

export const apiHaircutService: HaircutService = {
  async createSession(request: CreateHaircutSessionRequest): Promise<ApiResponse<HaircutSessionResponse>> {
    return createApiClient().request<HaircutSessionResponse>('/haircut/sessions', {
      method: 'POST',
      body: request,
    });
  },

  async getSession(sessionId: string): Promise<ApiResponse<HaircutSessionResponse>> {
    return createApiClient().request<HaircutSessionResponse>(`/haircut/sessions/${sessionId}`);
  },

  async addMoreOptions(sessionId: string): Promise<ApiResponse<HaircutSessionResponse>> {
    return createApiClient().request<HaircutSessionResponse>(`/haircut/sessions/${sessionId}/more`, {
      method: 'POST',
    });
  },

  async generateAngleShots(sessionId: string, request: GenerateHaircutAngleShotsRequest): Promise<ApiResponse<HaircutAngleShotsResponse>> {
    return createApiClient().request<HaircutAngleShotsResponse>(`/haircut/sessions/${sessionId}/angles`, {
      method: 'POST',
      body: request,
    });
  },

  async generateGuide(request: GenerateHaircutGuideRequest): Promise<ApiResponse<HaircutGuideResponse>> {
    return createApiClient().request<HaircutGuideResponse>('/haircut/guide', {
      method: 'POST',
      body: request,
    });
  },

  async saveSession(sessionId: string, request: SaveHaircutSessionRequest): Promise<ApiResponse<SaveHaircutSessionResponse>> {
    return createApiClient().request<SaveHaircutSessionResponse>(`/haircut/sessions/${sessionId}/save`, {
      method: 'POST',
      body: request,
    });
  },

  async unsaveSession(sessionId: string): Promise<ApiResponse<SaveHaircutSessionResponse>> {
    return createApiClient().request<SaveHaircutSessionResponse>(`/haircut/sessions/${sessionId}/save`, {
      method: 'DELETE',
    });
  },

  async listSavedSessions(): Promise<ApiResponse<SavedHaircutSessionsResponse>> {
    return createApiClient().request<SavedHaircutSessionsResponse>('/haircut/saved-sessions');
  },
};
