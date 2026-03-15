import type { ApiResponse, DeleteUploadResponse, UploadImageResponse } from '@/types/api';
import type { UploadsService } from '@/services/uploads/uploads-service';

export const mockUploadsService: UploadsService = {
  async uploadImage({ image, category, onProgress }) {
    onProgress?.(1);

    const response: UploadImageResponse = {
      id: `mock-upload-${Date.now()}`,
      category,
      storageProvider: 'mock',
      storageKey: `mock/${Date.now()}`,
      publicUrl: image.uri,
      originalFilename: image.fileName ?? null,
      mimeType: image.mimeType ?? null,
      sizeBytes: null,
      width: image.width ?? null,
      height: image.height ?? null,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: response,
      error: null,
    };
  },

  async deleteUpload() {
    return {
      success: true,
      data: { deleted: true },
      error: null,
    };
  },
};
