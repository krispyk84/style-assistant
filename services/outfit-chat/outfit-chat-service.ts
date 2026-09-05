import type { ApiResponse, OutfitChatRequest, OutfitChatResponse } from '@/types/api';

export type OutfitChatService = {
  askQuestion: (request: OutfitChatRequest) => Promise<ApiResponse<OutfitChatResponse>>;
};
