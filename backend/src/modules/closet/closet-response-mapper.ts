type ClosetItemRow = {
  id: string;
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageUrl: string | null;
  sketchImageUrl: string | null;
  sketchStatus: string;
  savedAt: Date;
  subcategory?: string | null;
  primaryColor?: string | null;
  colorFamily?: string | null;
  material?: string | null;
  formality?: string | null;
  silhouette?: string | null;
  season?: string | null;
  weight?: string | null;
  pattern?: string | null;
  notes?: string | null;
  fitStatus?: string | null;
};

export function mapClosetItem(item: ClosetItemRow) {
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    size: item.size,
    category: item.category,
    uploadedImageUrl: item.uploadedImageUrl,
    sketchImageUrl: item.sketchImageUrl,
    sketchStatus: item.sketchStatus,
    savedAt: item.savedAt.toISOString(),
    subcategory: item.subcategory ?? undefined,
    primaryColor: item.primaryColor ?? undefined,
    colorFamily: item.colorFamily ?? undefined,
    material: item.material ?? undefined,
    formality: item.formality ?? undefined,
    silhouette: item.silhouette ?? undefined,
    season: item.season ?? undefined,
    weight: item.weight ?? undefined,
    pattern: item.pattern ?? undefined,
    notes: item.notes ?? undefined,
    fitStatus: item.fitStatus ?? undefined,
  };
}
