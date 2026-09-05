import { useEffect, useState } from 'react';

import { outfitChatFlow, type OutfitChatContext } from '@/lib/outfit-chat-flow';
import { outfitChatService } from '@/services/outfit-chat';
import type { OutfitChatMessage } from '@/types/api';

export function useOutfitChat() {
  const [context, setContext] = useState<OutfitChatContext | null>(null);
  const [messages, setMessages] = useState<OutfitChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setContext(outfitChatFlow.consumePendingContext());
  }, []);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const history = messages;
    const userMessage: OutfitChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setErrorMessage(null);

    const response = await outfitChatService.askQuestion({
      ...context,
      question: trimmed,
      history,
    });

    setIsSending(false);

    if (!response.success || !response.data) {
      setErrorMessage(response.error?.message ?? 'Could not get an answer. Please try again.');
      return;
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: response.data!.answer }]);
  }

  return { context, messages, isSending, errorMessage, sendQuestion };
}
