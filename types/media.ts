export type LocalImageAsset = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  mimeType?: string | null;
};

export type UploadedImageCategory = 'anchor-item' | 'candidate-piece' | 'selfie';

export type UploadedImageAsset = {
  id: string;
  category: UploadedImageCategory;
  storageProvider: string;
  storageKey: string;
  publicUrl: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
};
