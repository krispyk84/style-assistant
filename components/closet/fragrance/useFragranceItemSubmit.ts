import { useState } from 'react';

import { buildProfileOverrides, type FragranceFormFields } from '@/lib/fragrance-form-mappers';
import { fragrancesService } from '@/services/fragrances';
import type { UserFragrance } from '@/types/fragrance';

type UseFragranceItemSubmitParams = {
  onSaved: (item: UserFragrance) => void;
  onDeleted: (id: string) => void;
};

export function useFragranceItemSubmit({ onSaved, onDeleted }: UseFragranceItemSubmitParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave(item: UserFragrance, fields: FragranceFormFields) {
    setIsSaving(true);
    setSaveError(null);

    const volume = fields.currentVolumeMl.trim() ? Number(fields.currentVolumeMl.trim()) : null;
    const response = await fragrancesService.updateUserFragrance(item.id, {
      isSignature: fields.isSignature,
      currentVolumeMl: volume !== null && !Number.isNaN(volume) ? volume : null,
      userNotes: fields.userNotes.trim() || undefined,
      profileOverrides: buildProfileOverrides(fields, item.fragrance),
    });

    setIsSaving(false);

    if (!response.success || !response.data) {
      setSaveError(response.error?.message ?? 'Could not save changes.');
      return;
    }

    onSaved(response.data);
  }

  async function handleDelete(item: UserFragrance) {
    setIsDeleting(true);
    setDeleteError(null);

    // Removes ownership only — the shared catalog Fragrance row is never
    // touched, matching the backend's removeUserFragrance contract.
    const response = await fragrancesService.removeUserFragrance(item.id);

    setIsDeleting(false);

    if (!response.success) {
      setDeleteError(response.error?.message ?? 'Could not remove this fragrance.');
      return;
    }

    onDeleted(item.id);
  }

  function clearErrors() {
    setSaveError(null);
    setDeleteError(null);
  }

  return { isSaving, saveError, isDeleting, deleteError, handleSave, handleDelete, clearErrors };
}
