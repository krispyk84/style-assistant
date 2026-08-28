import { createApiClient } from '@/lib/api/api-client';
import type {
  ApiResponse,
  CreateHaircutSessionRequest,
  GenerateHaircutGuideRequest,
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

  async generateGuide(request: GenerateHaircutGuideRequest): Promise<ApiResponse<HaircutGuideResponse>> {
    return createApiClient().request<HaircutGuideResponse>('/haircut/guide', {
      method: 'POST',
      body: request,
    });
  },
};
