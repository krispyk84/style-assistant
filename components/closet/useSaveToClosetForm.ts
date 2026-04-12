import { useEffect, useState } from 'react';

import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import { closetService } from '@/services/closet';
import type {
  ClosetItemColorFamily,
  ClosetItemFitStatus,
  ClosetItemFrameColor,
  ClosetItemLensShape,
  ClosetItemSilhouette,
} from '@/types/closet';
import type { UploadedImageAsset } from '@/types/media';
import { EMPTY_FORM_FIELDS, type ClosetFormFields } from './closet-form-mappers';

type UseSaveToClosetFormParams = {
  visible: boolean;
  effectiveUploadedImage: UploadedImageAsset | null;
  description: string | undefined;
};

export function useSaveToClosetForm({
  visible,
  effectiveUploadedImage,
  description,
}: UseSaveToClosetFormParams) {
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [material, setMaterial] = useState('');
  const [notes, setNotes] = useState('');
  const [colorFamily, setColorFamily] = useState<ClosetItemColorFamily | undefined>();
  const [silhouette, setSilhouette] = useState<ClosetItemSilhouette | undefined>();
  const [fitStatus, setFitStatus] = useState<ClosetItemFitStatus | undefined>();
  const [formality, setFormality] = useState<string | undefined>();
  const [weight, setWeight] = useState<string | undefined>();
  const [pattern, setPattern] = useState<string | undefined>();
  const [season, setSeason] = useState<string | undefined>();
  const [lensShape, setLensShape] = useState<ClosetItemLensShape | undefined>();
  const [frameColor, setFrameColor] = useState<ClosetItemFrameColor | undefined>();

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Pre-fill size from last-used when modal opens
  useEffect(() => {
    if (!visible) return;
    void loadAppSettings().then((settings) => {
      if (settings.lastUsedSize) setSize(settings.lastUsedSize);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset metadata fields when visible or the active uploaded image changes (queue advance)
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setBrand('');
    setCategory('');
    setSilhouette(undefined);
    setFitStatus(undefined);
    setSubcategory('');
    setPrimaryColor('');
    setColorFamily(undefined);
    setMaterial('');
    setFormality(undefined);
    setWeight(undefined);
    setPattern(undefined);
    setSeason(undefined);
    setLensShape(undefined);
    setFrameColor(undefined);
    setNotes('');
    setIsAnalyzing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, effectiveUploadedImage?.id]);

  function resetFields() {
    setTitle('');
    setBrand('');
    setCategory('');
    setSilhouette(undefined);
    setFitStatus(undefined);
    setSubcategory('');
    setPrimaryColor('');
    setColorFamily(undefined);
    setMaterial('');
    setFormality(undefined);
    setWeight(undefined);
    setPattern(undefined);
    setSeason(undefined);
    setLensShape(undefined);
    setFrameColor(undefined);
    setNotes('');
    setIsAnalyzing(false);
  }

  function resetAll() {
    resetFields();
    setSize('');
  }

  async function persistLastUsedSize(savedSize: string) {
    if (!savedSize.trim()) return;
    const settings = await loadAppSettings();
    await saveAppSettings({ ...settings, lastUsedSize: savedSize.trim() });
  }

  async function handleAIAutofill() {
    if (!effectiveUploadedImage) return;
    setIsAnalyzing(true);

    const response = await closetService.analyzeItem({
      uploadedImageId: effectiveUploadedImage.id,
      uploadedImageUrl: effectiveUploadedImage.publicUrl,
      description: description ?? '',
    });

    setIsAnalyzing(false);

    if (response.success && response.data) {
      const d = response.data;
      if (d.title) setTitle(d.title);
      if (d.category) setCategory(d.category);
      if (d.brand) setBrand(d.brand);
      if (d.silhouette) setSilhouette(d.silhouette as ClosetItemSilhouette);
      if (d.subcategory) setSubcategory(d.subcategory);
      if (d.primaryColor) setPrimaryColor(d.primaryColor);
      if (d.colorFamily) setColorFamily(d.colorFamily as ClosetItemColorFamily);
      if (d.material) setMaterial(d.material);
      if (d.formality) setFormality(d.formality);
      if (d.weight) setWeight(d.weight);
      if (d.pattern) setPattern(d.pattern);
      if (d.lensShape) setLensShape(d.lensShape as ClosetItemLensShape);
      if (d.frameColor) setFrameColor(d.frameColor as ClosetItemFrameColor);
    }
  }

  const fields: ClosetFormFields = {
    title,
    brand,
    size,
    category,
    subcategory,
    primaryColor,
    material,
    notes,
    colorFamily,
    silhouette,
    fitStatus,
    formality,
    weight,
    pattern,
    season,
    lensShape,
    frameColor,
  };

  const setters = {
    setTitle,
    setBrand,
    setSize,
    setCategory,
    setSubcategory,
    setPrimaryColor,
    setMaterial,
    setNotes,
    setColorFamily,
    setSilhouette,
    setFitStatus,
    setFormality,
    setWeight,
    setPattern,
    setSeason,
    setLensShape,
    setFrameColor,
  };

  return {
    fields,
    setters,
    isAnalyzing,
    handleAIAutofill,
    resetFields,
    resetAll,
    persistLastUsedSize,
  };
}
