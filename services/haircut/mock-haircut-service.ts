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

  async generateAngleShots(_sessionId: string, _request: GenerateHaircutAngleShotsRequest): Promise<ApiResponse<HaircutAngleShotsResponse>> {
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

  async saveSession(_sessionId: string, _request: SaveHaircutSessionRequest): Promise<ApiResponse<SaveHaircutSessionResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },

  async unsaveSession(_sessionId: string): Promise<ApiResponse<SaveHaircutSessionResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },

  async listSavedSessions(): Promise<ApiResponse<SavedHaircutSessionsResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Haircut Planner is not available right now.' },
    };
  },
};
