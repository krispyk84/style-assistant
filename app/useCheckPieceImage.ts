import { useEffect, useState } from 'react';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCheckPieceImage() {
  const {
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    takePhoto,
    removeImage,
  } = useUploadedImage('candidate-piece');

  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const [selectedClosetItem, setSelectedClosetItem] = useState<ClosetItem | null>(null);

  // Load closet items so we can offer the "From Closet" option
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) {
        setClosetItems(response.data.items);
      }
    });
  }, []);

  function clearClosetSelection() {
    setSelectedClosetItem(null);
  }

  return {
    // Photo picker + upload
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    takePhoto,
    removeImage,
    // Closet picker
    closetItems,
    closetPickerVisible,
    setClosetPickerVisible,
    selectedClosetItem,
    setSelectedClosetItem,
    clearClosetSelection,
  };
}
