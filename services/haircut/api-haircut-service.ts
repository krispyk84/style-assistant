import { createApiClient } from '@/lib/api/api-client';
import type {
  ApiResponse,
  CreateHaircutSessionRequest,
  GenerateHaircutAngleShotsRequest,
  GenerateHaircutGuideRequest,
  HaircutAngleShotsResponse,
  HaircutGuideResponse,
  HaircutSessionResponse,
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
};
