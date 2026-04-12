import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { trackClosetItemAdded } from '@/lib/analytics';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import type { UploadedImageAsset } from '@/types/media';
import { buildSaveItemPayload, type ClosetFormFields } from './closet-form-mappers';
import type { GenerateClosetSketchRequest } from '@/types/api';

type UseSaveToClosetSubmitParams = {
  onSaveSuccess: (item: ClosetItem) => void;
};

export function useSaveToClosetSubmit({ onSaveSuccess }: UseSaveToClosetSubmitParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchJobId, setSketchJobId] = useState<string | null>(null);
  const [sketchImageUrl, setSketchImageUrl] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);

  const sketchTranslateX = useRef(new Animated.Value(-140)).current;

  // Sketch loading bar animation
  useEffect(() => {
    if (!isGeneratingSketch) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sketchTranslateX, { toValue: 220, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sketchTranslateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isGeneratingSketch, sketchTranslateX]);

  // Poll for sketch completion when a job is in flight
  useEffect(() => {
    if (!sketchJobId) return;
    const interval = setInterval(() => {
      void closetService.getItemSketch(sketchJobId).then((response) => {
        if (!response.success || !response.data) return;
        if (response.data.sketchStatus === 'ready' && response.data.sketchImageUrl) {
          setSketchImageUrl(response.data.sketchImageUrl);
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        } else if (response.data.sketchStatus === 'failed') {
          setSketchError('Sketch generation failed. You can still save without it.');
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [sketchJobId]);

  async function handleGenerateSketch(effectiveUploadedImage: UploadedImageAsset, fields?: ClosetFormFields) {
    setSketchError(null);
    setIsGeneratingSketch(true);

    const sketchRequest: GenerateClosetSketchRequest = {
      uploadedImageId: effectiveUploadedImage.id,
      uploadedImageUrl: effectiveUploadedImage.publicUrl,
      title: fields?.title,
      category: fields?.category,
      lensShape: fields?.lensShape,
      frameColor: fields?.frameColor,
    };

    const response = await closetService.generateItemSketch(sketchRequest);

    if (response.success && response.data) {
      setSketchJobId(response.data.jobId);
    } else {
      setSketchError(response.error?.message ?? 'Sketch generation is not available right now.');
      setIsGeneratingSketch(false);
    }
  }

  async function handleSave(
    fields: ClosetFormFields,
    effectiveUploadedImage: UploadedImageAsset | null,
  ) {
    setIsSaving(true);
    setSaveError(null);

    const payload = buildSaveItemPayload(fields, effectiveUploadedImage, sketchImageUrl);
    const response = await closetService.saveItem(payload);

    setIsSaving(false);

    if (!response.success || !response.data) {
      setSaveError(response.error?.message ?? 'Failed to save item to closet.');
      return;
    }

    trackClosetItemAdded({ category: payload.category });
    onSaveSuccess(response.data);
  }

  function clearSaveError() {
    setSaveError(null);
  }

  function resetSketchState() {
    setIsGeneratingSketch(false);
    setSketchJobId(null);
    setSketchImageUrl(null);
    setSketchError(null);
  }

  return {
    isSaving,
    saveError,
    isGeneratingSketch,
    sketchImageUrl,
    sketchError,
    sketchTranslateX,
    handleGenerateSketch,
    handleSave,
    clearSaveError,
    resetSketchState,
  };
}
