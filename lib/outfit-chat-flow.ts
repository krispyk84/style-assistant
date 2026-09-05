import type { SecondOpinionSubject } from '@/types/api';

export type OutfitChatContext = SecondOpinionSubject & {
  sketchImageUrl?: string | null;
};

// One-way handoff: a card sets the outfit context right before navigating to
// /outfit-chat, and the new screen reads it once on mount — mirrors
// lib/camera-capture-result.ts's push/pop data handoff, but with no result
// coming back the other way.

let _pendingContext: OutfitChatContext | null = null;

export const outfitChatFlow = {
  setPendingContext(context: OutfitChatContext) {
    _pendingContext = context;
  },
  consumePendingContext(): OutfitChatContext | null {
    const context = _pendingContext;
    _pendingContext = null;
    return context;
  },
};
