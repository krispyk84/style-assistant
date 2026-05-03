import { useEffect, useState } from 'react';

import { closetService } from '@/services/closet';
import type { ClosetItem, ClosetItemColorFamily, ClosetItemFitStatus, ClosetItemFrameColor, ClosetItemLensShape, ClosetItemSilhouette } from '@/types/closet';
import {
  CLOSET_COLOR_FAMILY_OPTIONS,
  CLOSET_FORMALITY_OPTIONS,
  CLOSET_FRAME_COLOR_OPTIONS,
  CLOSET_LENS_SHAPE_OPTIONS,
  CLOSET_PATTERN_OPTIONS,
  CLOSET_SILHOUETTE_OPTIONS,
  CLOSET_WEIGHT_OPTIONS,
} from '@/types/closet';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClosetEditFields = {
  title: string;
  category: string;
  brand: string;
  size: string;
  subcategory: string;
  primaryColor: string;
  colorFamily: ClosetItemColorFamily | undefined;
  material: string;
  formality: string | undefined;
  silhouette: ClosetItemSilhouette | undefined;
  fitStatus: ClosetItemFitStatus | undefined;
  season: string | undefined;
  weight: string | undefined;
  pattern: string | undefined;
  notes: string;
  lensShape: ClosetItemLensShape | undefined;
  frameColor: ClosetItemFrameColor | undefined;
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useClosetItemEditor({ item }: { item: ClosetItem | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [silhouette, setSilhouette] = useState<ClosetItemSilhouette | undefined>();
  const [fitStatus, setFitStatus] = useState<ClosetItemFitStatus | undefined>();
  const [subcategory, setSubcategory] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [colorFamily, setColorFamily] = useState<ClosetItemColorFamily | undefined>();
  const [material, setMaterial] = useState('');
  const [formality, setFormality] = useState<string | undefined>();
  const [season, setSeason] = useState<string | undefined>();
  const [weight, setWeight] = useState<string | undefined>();
  const [pattern, setPattern] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [lensShape, setLensShape] = useState<ClosetItemLensShape | undefined>();
  const [frameColor, setFrameColor] = useState<ClosetItemFrameColor | undefined>();

  // Seed all fields from item; reset editing/confirmDelete/error when a different item opens
  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCategory(item.category);
    setBrand(item.brand);
    setSize(item.size);
    setSilhouette(item.silhouette ?? undefined);
    setFitStatus(item.fitStatus ?? undefined);
    setSubcategory(item.subcategory ?? '');
    setPrimaryColor(item.primaryColor ?? '');
    setColorFamily(item.colorFamily ?? undefined);
    setMaterial(item.material ?? '');
    setFormality(item.formality ?? undefined);
    setSeason(item.season ?? undefined);
    setWeight(item.weight ?? undefined);
    setPattern(item.pattern ?? undefined);
    setNotes(item.notes ?? '');
    setLensShape((item.lensShape as ClosetItemLensShape) ?? undefined);
    setFrameColor((item.frameColor as ClosetItemFrameColor) ?? undefined);
    setIsEditing(false);
    setError(null);
    setConfirmDelete(false);
  }, [item]);

  async function handleAIAutofill() {
    if (!item) return;
    if (!item.uploadedImageUrl && !item.sketchImageUrl) {
      setError('No image available for AI analysis. Add a photo to enable auto-fill.');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    const response = await closetService.analyzeItem({
      uploadedImageUrl: item.uploadedImageUrl ?? undefined,
      sketchImageUrl: item.sketchImageUrl ?? undefined,
    });
    setIsAnalyzing(false);
    if (!response.success || !response.data) {
      const msg = response.error?.code === 'IMAGE_UNAVAILABLE'
        ? 'Item image is no longer available. Re-save the item with a new photo.'
        : 'AI analysis failed. Please try again.';
      setError(msg);
      return;
    }
    const ai = response.data;
    // Non-destructive: only populate fields that are currently empty.
    // Validates structured fields against known options before applying.
    if (!subcategory && ai.subcategory) setSubcategory(ai.subcategory);
    if (!primaryColor && ai.primaryColor) setPrimaryColor(ai.primaryColor);
    if (!colorFamily && ai.colorFamily && CLOSET_COLOR_FAMILY_OPTIONS.some((o) => o.value === ai.colorFamily)) {
      setColorFamily(ai.colorFamily as ClosetItemColorFamily);
    }
    if (!material && ai.material) setMaterial(ai.material);
    if (!formality && ai.formality && CLOSET_FORMALITY_OPTIONS.some((o) => o.value === ai.formality)) {
      setFormality(ai.formality);
    }
    if (!weight && ai.weight && CLOSET_WEIGHT_OPTIONS.some((o) => o.value === ai.weight)) {
      setWeight(ai.weight);
    }
    if (!pattern && ai.pattern && CLOSET_PATTERN_OPTIONS.some((o) => o.value === ai.pattern)) {
      setPattern(ai.pattern);
    }
    // Silhouette — garment cut is reliably inferred from the image
    if (!silhouette && ai.silhouette && CLOSET_SILHOUETTE_OPTIONS.some((o) => o.value === ai.silhouette)) {
      setSilhouette(ai.silhouette as ClosetItemSilhouette);
    }
    if (!lensShape && ai.lensShape && CLOSET_LENS_SHAPE_OPTIONS.some((o) => o.value === ai.lensShape)) {
      setLensShape(ai.lensShape as ClosetItemLensShape);
    }
    if (!frameColor && ai.frameColor && CLOSET_FRAME_COLOR_OPTIONS.some((o) => o.value === ai.frameColor)) {
      setFrameColor(ai.frameColor as ClosetItemFrameColor);
    }
    // fitStatus intentionally NOT auto-filled — personal fit requires the wearer's judgement
  }

  /** Snapshot of current field values — pass to useClosetItemSubmit.handleSave at press time. */
  function getFields(): ClosetEditFields {
    return {
      title, category, brand, size,
      subcategory, primaryColor, colorFamily, material,
      formality, silhouette, fitStatus,
      season, weight, pattern, notes,
      lensShape, frameColor,
    };
  }

  return {
    isEditing, setIsEditing,
    confirmDelete, setConfirmDelete,
    error, setError,
    isAnalyzing,
    title, setTitle,
    category, setCategory,
    brand, setBrand,
    size, setSize,
    silhouette, setSilhouette,
    fitStatus, setFitStatus,
    subcategory, setSubcategory,
    primaryColor, setPrimaryColor,
    colorFamily, setColorFamily,
    material, setMaterial,
    formality, setFormality,
    season, setSeason,
    weight, setWeight,
    pattern, setPattern,
    notes, setNotes,
    lensShape, setLensShape,
    frameColor, setFrameColor,
    handleAIAutofill,
    getFields,
  };
}
