import { useState } from 'react';

import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import type { ClosetEditFields } from './useClosetItemEditor';

// ── Hook ───────────────────────────────────────────────────────────────────────

type Params = {
  item: ClosetItem | null;
  setError: (msg: string | null) => void;
  setIsEditing: (val: boolean) => void;
  onSaved: (item: ClosetItem) => void;
  onDeleted: (id: string) => void;
};

export function useClosetItemSubmit({ item, setError, setIsEditing, onSaved, onDeleted }: Params) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSave(fields: ClosetEditFields) {
    if (!item || !fields.title.trim()) return;
    setIsSaving(true);
    setError(null);
    const response = await closetService.updateItem({
      id: item.id,
      title: fields.title.trim(),
      brand: fields.brand.trim(),
      size: fields.size.trim(),
      category: fields.category.trim() || 'Clothing',
      silhouette: fields.silhouette,
      fitStatus: fields.fitStatus,
      subcategory: fields.subcategory.trim() || undefined,
      primaryColor: fields.primaryColor.trim() || undefined,
      colorFamily: fields.colorFamily,
      material: fields.material.trim() || undefined,
      formality: fields.formality,
      season: fields.season,
      weight: fields.weight,
      pattern: fields.pattern,
      notes: fields.notes.trim() || undefined,
    });
    setIsSaving(false);
    if (response.success && response.data) {
      setIsEditing(false);
      onSaved(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to save changes.');
    }
  }

  async function handleDelete() {
    if (!item) return;
    setIsDeleting(true);
    await closetService.deleteItem(item.id);
    setIsDeleting(false);
    onDeleted(item.id);
  }

  return { isSaving, isDeleting, handleSave, handleDelete };
}
