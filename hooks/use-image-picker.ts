import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { normalizePickedImage } from '@/lib/look-route';
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
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFromLibrary() {
    setIsPicking(true);
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Photo library access is required to choose an image.');
      setIsPicking(false);
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
      setIsPicking(false);
      return normalized;
    }

    setIsPicking(false);
    return null;
  }

  async function takePhoto() {
    setIsPicking(true);
    setError(null);

    try {
      const permission = await cameraImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError('Camera access is required to take a photo.');
        setIsPicking(false);
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
        setIsPicking(false);
        return normalized;
      }
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : 'Unable to open the camera.');
    }

    setIsPicking(false);
    return null;
  }

  function removeImage() {
    setImage(null);
  }

  return {
    image,
    isPicking,
    error,
    pickFromLibrary,
    takePhoto,
    removeImage,
    replaceImage: pickFromLibrary,
    setImage,
  };
}
