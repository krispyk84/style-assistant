import { useState, type RefObject } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type ViewShot from 'react-native-view-shot';

export function useHaircutGuideExport(viewShotRef: RefObject<ViewShot | null>) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function capture(): Promise<string | null> {
    const uri = await viewShotRef.current?.capture?.();
    return uri ?? null;
  }

  async function saveToPhotos() {
    setIsSaving(true);
    setMessage(null);
    try {
      const uri = await capture();
      if (!uri) {
        setMessage('Could not create the guide image.');
        return;
      }
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setMessage('Photo library access is needed to save the guide.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setMessage('Saved to your photo library.');
    } catch {
      setMessage('Could not save the guide. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function shareGuide() {
    setIsSaving(true);
    setMessage(null);
    try {
      const uri = await capture();
      if (!uri) {
        setMessage('Could not create the guide image.');
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setMessage('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri);
    } catch {
      setMessage('Could not share the guide. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return { isSaving, message, saveToPhotos, shareGuide };
}
