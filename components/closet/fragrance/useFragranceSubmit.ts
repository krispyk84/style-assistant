import { useState } from 'react';

import {
  accordNamesToAccords,
  buildManualFragrancePayload,
  buildProfileOverrides,
  identityMatchesResolved,
  selectedToDimensionDict,
  type FragranceFormFields,
} from '@/lib/fragrance-form-mappers';
import { fragrancesService } from '@/services/fragrances';
import type { Fragrance, UserFragrance } from '@/types/fragrance';
import type { UploadedImageAsset } from '@/types/media';

type UseFragranceSubmitParams = {
  onSaveSuccess: (item: UserFragrance) => void;
};

export function useFragranceSubmit({ onSaveSuccess }: UseFragranceSubmitParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Resolves (or creates) the catalog Fragrance row this save should point
   * at. When the form still matches an AI-resolved fragrance, that id is
   * reused directly with any edited fields sent as profileOverrides — never
   * mutating the shared catalog row. Otherwise (manual entry, needs_review,
   * or the user edited brand/name away from the AI match), a fresh
   * catalog-deduped row is resolved via the no-AI manual endpoint.
   */
  async function resolveFragranceId(
    fields: FragranceFormFields,
    resolvedFragrance: Fragrance | null,
  ): Promise<{ fragranceId: string; profileOverrides?: Record<string, unknown> } | { error: string }> {
    if (resolvedFragrance && identityMatchesResolved(fields, resolvedFragrance)) {
      return { fragranceId: resolvedFragrance.id, profileOverrides: buildProfileOverrides(fields, resolvedFragrance) };
    }

    const manualResponse = await fragrancesService.createManualFragrance(buildManualFragrancePayload(fields));
    if (!manualResponse.success || !manualResponse.data) {
      return { error: manualResponse.error?.message ?? 'Could not save this fragrance.' };
    }

    // A manually-created/deduped row may itself have accords/vibes beyond
    // what the (possibly limited) manual payload carried — diff against it
    // the same way, so a real catalog hit's existing profile isn't silently
    // discarded by treating every manual field as an override.
    return { fragranceId: manualResponse.data.id, profileOverrides: buildProfileOverrides(fields, manualResponse.data) };
  }

  async function handleSave(
    fields: FragranceFormFields,
    resolvedFragrance: Fragrance | null,
    uploadedImage: UploadedImageAsset | null,
    bottleSketchUrl: string | null,
  ) {
    setIsSaving(true);
    setSaveError(null);

    const resolved = await resolveFragranceId(fields, resolvedFragrance);
    if ('error' in resolved) {
      setIsSaving(false);
      setSaveError(resolved.error);
      return;
    }

    const volume = fields.currentVolumeMl.trim() ? Number(fields.currentVolumeMl.trim()) : null;

    const response = await fragrancesService.addToCloset({
      fragranceId: resolved.fragranceId,
      originalImageUrl: uploadedImage?.publicUrl,
      bottleSketchUrl: bottleSketchUrl ?? undefined,
      isSignature: fields.isSignature,
      currentVolumeMl: volume !== null && !Number.isNaN(volume) ? volume : null,
      userNotes: fields.userNotes.trim() || undefined,
      profileOverrides: resolved.profileOverrides,
    });

    setIsSaving(false);

    if (!response.success || !response.data) {
      setSaveError(response.error?.message ?? 'Failed to save fragrance to closet.');
      return;
    }

    onSaveSuccess(response.data);
  }

  function clearSaveError() {
    setSaveError(null);
  }

  return {
    isSaving,
    saveError,
    handleSave,
    clearSaveError,
  };
}

// Re-exported for tests — pure helpers used above, kept accessible without
// reaching into lib/fragrance-form-mappers directly from test files that are
// exercising this hook's save-resolution behavior specifically.
export { accordNamesToAccords, selectedToDimensionDict };
