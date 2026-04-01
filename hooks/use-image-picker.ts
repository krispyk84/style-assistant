import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { normalizePickedImage } from '@/lib/media-utils';
import type { LocalImageAsset } from '@/types/media';

export function useImagePicker(initialImage: LocalImageAsset | null = null) {
  const cameraImagePicker = ImagePicker as typeof ImagePicker & {
    requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
    launchCameraAsync: (options: {
      allowsEditing: boolean;
      cameraType: 'back' | 'front';
      mediaTypes: string[];
      quality: number;
    }) => Promise<ImagePicker.ImagePickerResult>;
    CameraType: {
      back: 'back';
      front: 'front';
    };
  };
  const [image, setImage] = useState<LocalImageAsset | null>(initialImage);
  // Track which specific action is in progress so buttons have independent state
  const [pickingSource, setPickingSource] = useState<'library' | 'camera' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPicking = pickingSource !== null;
  const isPickingLibrary = pickingSource === 'library';
  const isPickingCamera = pickingSource === 'camera';

  async function pickFromLibrary() {
    setPickingSource('library');
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Photo library access is required to choose an image.');
      setPickingSource(null);
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const normalized = normalizePickedImage(result.assets[0]);
      setImage(normalized);
      setPickingSource(null);
      return normalized;
    }

    setPickingSource(null);
    return null;
  }

  async function takePhoto() {
    setPickingSource('camera');
    setError(null);

    try {
      const permission = await cameraImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError('Camera access is required to take a photo.');
        setPickingSource(null);
        return null;
      }

      const result = await cameraImagePicker.launchCameraAsync({
        allowsEditing: true,
        cameraType: cameraImagePicker.CameraType.back,
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const normalized = normalizePickedImage(result.assets[0]);
        setImage(normalized);
        setPickingSource(null);
        return normalized;
      }
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : 'Unable to open the camera.');
    }

    setPickingSource(null);
    return null;
  }

  function removeImage() {
    setImage(null);
  }

  return {
    image,
    isPicking,
    isPickingLibrary,
    isPickingCamera,
    error,
    pickFromLibrary,
    takePhoto,
    removeImage,
    replaceImage: pickFromLibrary,
    setImage,
  };
}
