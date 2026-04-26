import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { outfitsService } from '@/services/outfits';
import { parseLookInput, type LookRouteParams } from '@/lib/look-route';
import type { GenerateOutfitsResponse } from '@/types/api';
import { LOOK_TIER_OPTIONS, type CreateLookInput, type LookTierSlug } from '@/types/look-request';
import { trackCreateLookCompleted, trackCreateLookFailed } from '@/lib/analytics';
import { recordError, log } from '@/lib/crashlytics';

export function useResultsData(stableParams: LookRouteParams & { requestId: string }) {
  const [response, setResponse] = useState<GenerateOutfitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tiers still being fetched from OpenAI (shown as loading placeholders in results view)
  const [loadingTiers, setLoadingTiers] = useState<LookTierSlug[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regeneratingTiers, setRegeneratingTiers] = useState<LookTierSlug[]>([]);
  // Ref mirrors state so the sketch-poll callback always sees the current regenerating set
  // without needing to re-create the interval on every state change.
  const regeneratingTiersRef = useRef<LookTierSlug[]>([]);
  const [tierGenerations, setTierGenerations] = useState<Partial<Record<LookTierSlug, number>>>({});
  const generateAbortRef = useRef<AbortController | null>(null);

  const parsedInput = useMemo(() => parseLookInput(stableParams), [stableParams]);

  // Keep ref in sync so the poll closure always reads the current set without re-creating the interval.
  useEffect(() => {
    regeneratingTiersRef.current = regeneratingTiers;
  }, [regeneratingTiers]);

  // Keep screen awake while generating (initial load or remaining tiers still loading).
  // Both deps live in this hook so the effect needs no cross-hook access.
  useEffect(() => {
    if (isLoading || loadingTiers.length > 0) {
      void activateKeepAwakeAsync();
    } else {
      void deactivateKeepAwake();
    }
    return () => { void deactivateKeepAwake(); };
  }, [isLoading, loadingTiers.length]);

  async function fetchOutfits(requestId: string, input: CreateLookInput | null) {
    setIsLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    generateAbortRef.current = controller;

    if (!input) {
      // Fetching an existing result — no progressive loading needed.
      const serviceResponse = await outfitsService.getOutfitResult(requestId);
      generateAbortRef.current = null;
      if (controller.signal.aborted) return;
      if (!serviceResponse.success || !serviceResponse.data) {
        setErrorMessage(serviceResponse.error?.message ?? 'Failed to load outfit results.');
      } else {
        setResponse(serviceResponse.data);
      }
      setIsLoading(false);
      return;
    }

    // Progressive generation: fire tiers sequentially in canonical order.
    const tiersInOrder = LOOK_TIER_OPTIONS.filter((t) => input.selectedTiers.includes(t));
    setLoadingTiers(tiersInOrder);

    let mergedResponse: GenerateOutfitsResponse | null = null;

    for (const tier of tiersInOrder) {
      if (controller.signal.aborted) return;

      const serviceResponse = await outfitsService.generateOutfits(
        { ...input, requestId, selectedTiers: tiersInOrder, generateOnlyTier: tier },
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;

      if (!serviceResponse.success || !serviceResponse.data) {
        setLoadingTiers((prev) => prev.filter((t) => t !== tier));
        if (!mergedResponse) {
          // First tier failed — surface the error as a full failure.
          setErrorMessage(serviceResponse.error?.message ?? 'Failed to generate outfit.');
          trackCreateLookFailed({ error: serviceResponse.error?.code });
          recordError(
            new Error(serviceResponse.error?.message ?? 'Outfit generation failed'),
            'create_look_generation',
          );
          setIsLoading(false);
          generateAbortRef.current = null;
          return;
        }
        // Subsequent tier failed — skip it, continue with remaining tiers.
        log(`[tier-generation] tier '${tier}' failed: ${serviceResponse.error?.code} — ${serviceResponse.error?.message}`);
        recordError(
          new Error(`Tier generation failed: ${tier} — ${serviceResponse.error?.message ?? 'unknown'}`),
          'tier_generation_failure',
        );
        continue;
      }

      const tierData = serviceResponse.data;
      const newRec = tierData.recommendations.find((r) => r.tier === tier);
      if (!newRec) {
        log(`[tier-generation] tier '${tier}' succeeded but recommendation not found in response. Returned tiers: ${tierData.recommendations.map((r) => r.tier).join(', ')}`);
      }

      if (!mergedResponse) {
        // First tier done: show results immediately with this tier + placeholders for the rest.
        mergedResponse = tierData;
        setResponse(tierData);
        setIsLoading(false);
        trackCreateLookCompleted({ tier_count: tiersInOrder.length });
        log(`Look generated: ${requestId} (first tier: ${tier})`);
      } else if (newRec) {
        // Merge subsequent tier into the existing response.
        const previousResponse = mergedResponse as GenerateOutfitsResponse;
        const nextResponse: GenerateOutfitsResponse = {
          ...previousResponse,
          recommendations: [...previousResponse.recommendations, newRec],
        };
        mergedResponse = nextResponse;
        setResponse(nextResponse);
      }

      setLoadingTiers((prev) => prev.filter((t) => t !== tier));
    }

    generateAbortRef.current = null;
  }

  function handleCancelGeneration() {
    generateAbortRef.current?.abort();
    router.back();
  }

  function handleRetry() {
    if (stableParams.requestId) {
      void fetchOutfits(stableParams.requestId, parsedInput);
    }
  }

  useEffect(() => {
    if (!stableParams.requestId) {
      setIsLoading(false);
      setErrorMessage('Missing request id.');
      return;
    }

    void fetchOutfits(stableParams.requestId, parsedInput);
    // fetchOutfits is stable within the effect — deps are the actual inputs
  }, [stableParams.requestId, parsedInput]);

  return {
    response,
    setResponse,
    isLoading,
    loadingTiers,
    errorMessage,
    setErrorMessage,
    regeneratingTiers,
    setRegeneratingTiers,
    regeneratingTiersRef,
    tierGenerations,
    setTierGenerations,
    parsedInput,
    handleCancelGeneration,
    handleRetry,
  };
}
