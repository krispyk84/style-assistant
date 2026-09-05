import type { OutfitChatService } from '@/services/outfit-chat/outfit-chat-service';

export const mockOutfitChatService: OutfitChatService = {
  async askQuestion(request) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      success: true,
      data: {
        answer: `Mock answer to: "${request.question}" — a tonal tie in a slightly darker shade would work well here without fighting the rest of the outfit.`,
      },
      error: null,
    };
  },
};
