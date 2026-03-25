export type ClosetItemSketchStatus = 'pending' | 'ready' | 'failed';

export type ClosetItem = {
  id: string;
  title: string;
  brand: string;
  size: string;
  category: string;
  uploadedImageUrl: string | null;
  sketchImageUrl: string | null;
  sketchStatus: ClosetItemSketchStatus;
  savedAt: string;
};
