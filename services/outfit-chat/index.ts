import { canUseRealApi } from '@/lib/api/api-client';
import { apiOutfitChatService } from '@/services/outfit-chat/api-outfit-chat-service';
import { mockOutfitChatService } from '@/services/outfit-chat/mock-outfit-chat-service';

export const outfitChatService = canUseRealApi() ? apiOutfitChatService : mockOutfitChatService;
export type { OutfitChatService } from '@/services/outfit-chat/outfit-chat-service';
