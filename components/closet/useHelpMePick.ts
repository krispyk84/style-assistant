import { useState } from 'react';

import { closetService } from '@/services/closet';
import type { HelpMePickResponse } from '@/types/api';
import type { StylistId } from '@/lib/stylists';

// ── State machine ─────────────────────────────────────────────────────────────
// 'intent'  → user is filling in the form (stylist + 3 questions)
// 'loading' → request in flight
// 'result'  → LLM has returned a pick

export type HelpMePickModalState = 'intent' | 'loading' | 'result';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHelpMePick() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<HelpMePickModalState>('intent');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HelpMePickResponse | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);

  // Form fields
  const [stylistId, setStylistId] = useState<StylistId>('vittorio');
  const [dayType, setDayType] = useState('casual');
  const [vibe, setVibe] = useState('classic');
  const [risk, setRisk] = useState('balanced');
  const [season, setSeason] = useState('');

  function open() {
    setModalState('intent');
    setError(null);
    setResult(null);
    setRejectedIds([]);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  async function handlePick() {
    setModalState('loading');
    setError(null);
    const response = await closetService.helpMePick({ stylistId, dayType, vibe, risk, season: season || undefined, rejectedIds });
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'Could not pick an item. Please try again.');
      setModalState('intent');
      return;
    }
    setResult(response.data);
    setModalState('result');
  }

  function handlePickAgain() {
    if (result) {
      setRejectedIds((prev) => [...prev, result.itemId]);
    }
    setResult(null);
    setModalState('intent');
  }

  return {
    isOpen, open, close,
    modalState,
    error, setError,
    result,
    stylistId, setStylistId,
    dayType, setDayType,
    vibe, setVibe,
    risk, setRisk,
    season, setSeason,
    handlePick,
    handlePickAgain,
  };
}
