import type {
  ApiResponse,
  CreateHaircutSessionRequest,
  GenerateHaircutGuideRequest,
  HaircutGuideResponse,
  HaircutSessionResponse,
} from '@/types/api';

export type HaircutService = {
  createSession: (request: CreateHaircutSessionRequest) => Promise<ApiResponse<HaircutSessionResponse>>;
  getSession: (sessionId: string) => Promise<ApiResponse<HaircutSessionResponse>>;
  generateGuide: (request: GenerateHaircutGuideRequest) => Promise<ApiResponse<HaircutGuideResponse>>;
};
