import type { ApiResponse, SecondOpinionRequest, SecondOpinionResponse } from '@/types/api';

export type SecondOpinionService = {
  getOpinion: (request: SecondOpinionRequest) => Promise<ApiResponse<SecondOpinionResponse>>;
};
