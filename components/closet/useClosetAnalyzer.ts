import { useState } from 'react';

import { closetService } from '@/services/closet';
import type { ClosetAnalyseResponse } from '@/types/api';

export type ClosetAnalyzerModalState = 'loading' | 'result' | 'error';

export function useClosetAnalyzer() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ClosetAnalyzerModalState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<ClosetAnalyseResponse | null>(null);

  function open() {
    setError(null);
    setIsOpen(true);
    if (cachedResult) {
      setModalState('result');
    } else {
      setModalState('loading');
      void handleAnalyse();
    }
  }

  function close() {
    setIsOpen(false);
  }

  async function handleAnalyse() {
    const response = await closetService.analyseCloset();
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not analyse your closet. Please try again.');
      setModalState('error');
      return;
    }
    setCachedResult(response.data);
    setModalState('result');
  }

  function refresh() {
    setCachedResult(null);
    setModalState('loading');
    void handleAnalyse();
  }

  return {
    isOpen, open, close,
    modalState,
    error,
    result: cachedResult,
    refresh,
  };
}
