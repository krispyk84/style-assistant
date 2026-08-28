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

export type HaircutService = {
  createSession: (request: CreateHaircutSessionRequest) => Promise<ApiResponse<HaircutSessionResponse>>;
  getSession: (sessionId: string) => Promise<ApiResponse<HaircutSessionResponse>>;
  addMoreOptions: (sessionId: string) => Promise<ApiResponse<HaircutSessionResponse>>;
  generateAngleShots: (sessionId: string, request: GenerateHaircutAngleShotsRequest) => Promise<ApiResponse<HaircutAngleShotsResponse>>;
  generateGuide: (request: GenerateHaircutGuideRequest) => Promise<ApiResponse<HaircutGuideResponse>>;
  saveSession: (sessionId: string, request: SaveHaircutSessionRequest) => Promise<ApiResponse<SaveHaircutSessionResponse>>;
  unsaveSession: (sessionId: string) => Promise<ApiResponse<SaveHaircutSessionResponse>>;
  listSavedSessions: () => Promise<ApiResponse<SavedHaircutSessionsResponse>>;
};
