import { createApiClient } from '@/lib/api/api-client';
import type { OutfitChatService } from '@/services/outfit-chat/outfit-chat-service';

export const apiOutfitChatService: OutfitChatService = {
  askQuestion(request) {
    return createApiClient().request('/outfit-chat', {
      method: 'POST',
      body: request,
    });
  },
};
