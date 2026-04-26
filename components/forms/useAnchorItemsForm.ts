import { useCallback, useEffect, useRef, useState } from 'react';

import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import type { CreateLookInput, LookAnchorItem } from '@/types/look-request';
import { buildInitialAnchorItems, createEmptyAnchorItem } from './createLookRequest-mappers';

export function useAnchorItemsForm(initialValue: CreateLookInput) {
  const [anchorItems, setAnchorItems] = useState<LookAnchorItem[]>(() =>
    buildInitialAnchorItems(initialValue),
  );
  const [shouldAddAnchorToCloset, setShouldAddAnchorToCloset] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const closetPickerTargetId = useRef<string | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────

  const populatedAnchorItems = anchorItems.filter(
    (item) => item.description.trim() || item.image || item.uploadedImage,
  );

  const isUploading = anchorItems.some(
    (item) => item.uploadedImage === null && item.image !== null,
  );

  const primaryAnchorUpload = anchorItems[0]?.uploadedImage;
  const showAddToClosetCheckbox =
    primaryAnchorUpload != null && primaryAnchorUpload.storageProvider !== 'closet-ref';

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    void closetService.getItems().then((r) => {
      if (r.success && r.data) setClosetItems(r.data.items);
    });
  }, []);

  // Reset checkbox if primary anchor no longer has a photo-based upload
  useEffect(() => {
    if (!showAddToClosetCheckbox) setShouldAddAnchorToCloset(false);
  }, [showAddToClosetCheckbox]);

  // ── Anchor item mutations ───────────────────────────────────────────────────

  // useCallback with empty deps: setAnchorItems and setAnchorError are stable setState
  // dispatchers. Without useCallback, updateAnchorItem gets a new reference every render,
  // which causes AnchorItemCard's useEffect([onChange]) to fire → setAnchorItems →
  // re-render → new reference → infinite loop → "Maximum update depth exceeded" →
  // React unmounts the tree silently (effect errors don't reach ErrorBoundary) → blank screen.
  const updateAnchorItem = useCallback((nextItem: LookAnchorItem) => {
    setAnchorItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)));
    setAnchorError(null);
  }, []);

  function addAnchorItem() {
    setAnchorItems((current) => (current.length >= 5 ? current : [...current, createEmptyAnchorItem()]));
  }

  function removeAnchorItem(itemId: string) {
    setAnchorItems((current) => current.filter((item) => item.id !== itemId));
  }

  // ── Closet picker ───────────────────────────────────────────────────────────

  function handlePickFromCloset(anchorItemId: string) {
    // Write the ref before opening the modal so the value is readable synchronously
    // when handleClosetItemSelected fires after the re-render.
    closetPickerTargetId.current = anchorItemId;
    setClosetPickerVisible(true);
  }

  function handleClosetItemSelected(closetItem: ClosetItem) {
    void closetService.recordAnchorUsed(closetItem.id);
    const imageUrl = closetItem.sketchImageUrl ?? closetItem.uploadedImageUrl ?? '';
    setAnchorItems((current) =>
      current.map((item) => {
        if (item.id !== closetPickerTargetId.current) return item;
        return {
          // New id causes React to remount the AnchorItemCard, reinitialising it
          // cleanly from the closet item data.
          id: `closet-${closetItem.id}-${Date.now()}`,
          description: closetItem.title,
          image: null,
          uploadedImage: imageUrl
            ? {
                id: closetItem.id,
                category: 'anchor-item' as const,
                storageProvider: 'closet-ref' as const,
                storageKey: imageUrl,
                publicUrl: imageUrl,
                originalFilename: null,
                mimeType: null,
                sizeBytes: null,
                width: null,
                height: null,
                createdAt: new Date().toISOString(),
              }
            : null,
        };
      }),
    );
    closetPickerTargetId.current = null;
    setClosetPickerVisible(false);
  }

  function handleClosetPickerClose() {
    closetPickerTargetId.current = null;
    setClosetPickerVisible(false);
  }

  return {
    // State
    anchorItems,
    shouldAddAnchorToCloset,
    closetItems,
    closetPickerVisible,
    anchorError,
    // Derived
    populatedAnchorItems,
    isUploading,
    showAddToClosetCheckbox,
    // Setters exposed for container validation
    setAnchorError,
    // Mutations
    updateAnchorItem,
    addAnchorItem,
    removeAnchorItem,
    toggleShouldAddAnchorToCloset: () => setShouldAddAnchorToCloset((v) => !v),
    handlePickFromCloset,
    handleClosetItemSelected,
    handleClosetPickerClose,
  };
}
