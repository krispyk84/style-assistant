import { useState } from 'react';

import { useImagePicker } from '@/hooks/use-image-picker';
import { uploadsService } from '@/services/uploads';
import type { LocalImageAsset, UploadedImageAsset, UploadedImageCategory } from '@/types/media';

export function useUploadedImage(category: UploadedImageCategory, initialImage: LocalImageAsset | null = null, initialUploadedImage: UploadedImageAsset | null = null) {
  const {
    image,
    isPicking,
    isPickingLibrary,
    isPickingCamera,
    error: pickerError,
    pickFromLibrary,
    pickMultipleFromLibrary,
    takePhoto,
    removeImage,
    setImage,
  } = useImagePicker(initialImage);
  const [uploadedImage, setUploadedImage] = useState<UploadedImageAsset | null>(initialUploadedImage);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  async function uploadSelectedImage(nextImage: LocalImageAsset | null) {
    if (!nextImage) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccessMessage(null);

    try {
      if (uploadedImage) {
        try {
          await uploadsService.deleteUpload(uploadedImage.id);
        } catch {
          // Ignore stale-upload cleanup failures and continue with the new upload.
        }
        setUploadedImage(null);
      }

      const response = await uploadsService.uploadImage({
        image: nextImage,
        category,
        onProgress: setUploadProgress,
      });

      if (response.success && response.data) {
        setUploadedImage(response.data);
        setUploadProgress(1);
        setUploadSuccessMessage('Upload complete.');
      } else {
        setUploadProgress(0);
        setUploadError(response.error?.message ?? 'Image upload failed.');
      }
    } catch {
      setUploadProgress(0);
      setUploadError('Image upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  async function pickAndUpload() {
    const nextImage = await pickFromLibrary();
    await uploadSelectedImage(nextImage);
  }

  async function captureAndUpload() {
    const nextImage = await takePhoto();
    await uploadSelectedImage(nextImage);
  }

  /**
   * Multi-select library picker. Picks up to 10 images, immediately uploads the
   * first one (updating the hook's image/uploadedImage state), and returns all
   * selected assets so the caller can queue the remainder.
   */
  async function pickMultipleAndUploadFirst(): Promise<LocalImageAsset[]> {
    const assets = await pickMultipleFromLibrary();
    if (assets.length === 0) return [];
    const first = assets[0]!;
    setImage(first);
    await uploadSelectedImage(first);
    return assets;
  }

  async function removeUploadedImage() {
    if (uploadedImage) {
      await uploadsService.deleteUpload(uploadedImage.id);
    }

    removeImage();
    setUploadedImage(null);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccessMessage(null);
  }

  return {
    image,
    uploadedImage,
    isPicking,
    isPickingLibrary,
    isPickingCamera,
    isUploading,
    uploadProgress,
    error: uploadError ?? pickerError,
    uploadSuccessMessage,
    pickFromLibrary: pickAndUpload,
    pickMultipleFromLibrary: pickMultipleAndUploadFirst,
    takePhoto: captureAndUpload,
    /** Upload a pre-selected LocalImageAsset (used by the queue flow). */
    uploadImage: uploadSelectedImage,
    removeImage: removeUploadedImage,
    replaceImage: pickAndUpload,
    setImage,
    setUploadedImage,
  };
}
