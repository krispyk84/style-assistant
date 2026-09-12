import { useEffect, useRef } from 'react';

import { recordError } from '@/lib/crashlytics';
import { outfitsService } from '@/services/outfits';
import type { GenerateOutfitsResponse } from '@/types/api';

/**
 * One thing to poll: `key` is whatever identity the caller uses to apply the
 * result back to its own state (a fixed sentinel for the single-response
 * caller, the requestId itself for the multi-look caller); `requestId` is
 * always the actual outfitsService.getOutfitResult() argument. The two are
 * often the same value (MultiLookResults) but don't have to be
 * ([requestId].tsx uses a fixed key since it only ever has one response).
 */
export type ResultsPollTarget = { key: string; requestId: string };

type UseResultsPollingParams = {
  /** Recomputed by the caller on every render from its own pending-detection
   * logic — this hook derives its own stable signature from the CONTENT
   * (key+requestId pairs), not from array identity, so passing a fresh
   * array each render is safe and does not recreate the interval unless the
   * actual set of targets changes. */
  targets: ResultsPollTarget[];
  /** Called once per target that successfully returns data on a tick. The
   * caller owns applying this to its own state shape (a full replace for a
   * single independent slot, or a merge that protects in-flight
   * regeneration for the single-response/multi-tier caller). */
  onResult: (key: string, data: GenerateOutfitsResponse) => void;
};

const POLL_INTERVAL_MS = 4000;

/**
 * Shared polling primitive for both results screens: batches N independent
 * `getOutfitResult` polls on one interval, single-flight-guarded as ONE
 * batch (a slow tick never overlaps with the next), and never lets a
 * rejected request become an unhandled promise rejection. Depends on a
 * signature string derived from `targets`' content rather than `targets`
 * itself, so a caller recomputing a fresh array every render (because its
 * own state changed) does not tear down and recreate the interval unless
 * the actual set of things needing a poll changed.
 */
export function useResultsPolling({ targets, onResult }: UseResultsPollingParams) {
  const signature = targets.map((t) => `${t.key}:${t.requestId}`).join(',');
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!targets.length) return;

    const interval = setInterval(async () => {
      // Skip this tick if the previous one is still awaiting — a slow
      // response must not overlap with the next scheduled poll.
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        await Promise.all(
          targets.map(async ({ key, requestId }) => {
            const result = await outfitsService.getOutfitResult(requestId);
            if (result.success && result.data) onResult(key, result.data);
          }),
        );
      } catch (error) {
        // outfitsService.getOutfitResult goes through ApiClient.request,
        // which never rejects in practice — this exists so a poll tick can
        // never become an unhandled rejection if that contract ever changes.
        recordError(error, 'results_polling_tick_failed');
      } finally {
        isPollingRef.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // targets/onResult are recomputed every render by design — signature is
    // the real, content-based dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
