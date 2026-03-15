import type { ApiResponse, DeleteUploadResponse, UploadImageResponse } from '@/types/api';
import type { LocalImageAsset, UploadedImageCategory } from '@/types/media';

export type UploadsService = {
  uploadImage: (input: {
    image: LocalImageAsset;
    category: UploadedImageCategory;
    onProgress?: (progress: number) => void;
  }) => Promise<ApiResponse<UploadImageResponse>>;
  deleteUpload: (uploadId: string) => Promise<ApiResponse<DeleteUploadResponse>>;
};
