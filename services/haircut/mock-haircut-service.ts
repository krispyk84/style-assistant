import type {
  ApiResponse,
  CreateHaircutSessionRequest,
  GenerateHaircutGuideRequest,
  HaircutGuideResponse,
  HaircutSessionResponse,
} from '@/types/api';
import type { HaircutService } from './haircut-service';

export const mockHaircutService: HaircutService = {
  async createSession(_request: CreateHaircutSessionRequest): Promise<ApiResponse<HaircutSessionResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },

  async getSession(_sessionId: string): Promise<ApiResponse<HaircutSessionResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },

  async addMoreOptions(_sessionId: string): Promise<ApiResponse<HaircutSessionResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },

  async generateGuide(_request: GenerateHaircutGuideRequest): Promise<ApiResponse<HaircutGuideResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },
};
