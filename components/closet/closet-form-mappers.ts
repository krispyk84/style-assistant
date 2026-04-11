import type { SaveClosetItemRequest } from '@/types/api';
import type {
  ClosetItemColorFamily,
  ClosetItemFitStatus,
  ClosetItemSilhouette,
} from '@/types/closet';
import type { UploadedImageAsset } from '@/types/media';

// ── Canonical form field shape ─────────────────────────────────────────────────

export type ClosetFormFields = {
  title: string;
  brand: string;
  size: string;
  category: string;
  subcategory: string;
  primaryColor: string;
  material: string;
  notes: string;
  colorFamily: ClosetItemColorFamily | undefined;
  silhouette: ClosetItemSilhouette | undefined;
  fitStatus: ClosetItemFitStatus | undefined;
  formality: string | undefined;
  weight: string | undefined;
  pattern: string | undefined;
  season: string | undefined;
};

export const EMPTY_FORM_FIELDS: ClosetFormFields = {
  title: '',
  brand: '',
  size: '',
  category: '',
  subcategory: '',
  primaryColor: '',
  material: '',
  notes: '',
  colorFamily: undefined,
  silhouette: undefined,
  fitStatus: undefined,
  formality: undefined,
  weight: undefined,
  pattern: undefined,
  season: undefined,
};

// ── Mapper ─────────────────────────────────────────────────────────────────────

export function buildSaveItemPayload(
  fields: ClosetFormFields,
  effectiveUploadedImage: UploadedImageAsset | null,
  sketchImageUrl: string | null,
): SaveClosetItemRequest {
  return {
    title: fields.title.trim(),
    brand: fields.brand.trim(),
    size: fields.size.trim(),
    category: fields.category.trim() || 'Clothing',
    uploadedImageId: effectiveUploadedImage?.id,
    uploadedImageUrl: effectiveUploadedImage?.publicUrl,
    sketchImageUrl: sketchImageUrl ?? undefined,
    silhouette: fields.silhouette,
    fitStatus: fields.fitStatus,
    subcategory: fields.subcategory.trim() || undefined,
    primaryColor: fields.primaryColor.trim() || undefined,
    colorFamily: fields.colorFamily,
    material: fields.material.trim() || undefined,
    formality: fields.formality,
    weight: fields.weight,
    pattern: fields.pattern,
    season: fields.season,
    notes: fields.notes.trim() || undefined,
  };
}
