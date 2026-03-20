import { appConfig } from '@/constants/config';
import type { ApiResponse, DeleteUploadResponse, UploadImageResponse } from '@/types/api';
import type { LocalImageAsset, UploadedImageCategory } from '@/types/media';
import type { UploadsService } from '@/services/uploads/uploads-service';

function uploadWithProgress(input: {
  image: LocalImageAsset;
  category: UploadedImageCategory;
  onProgress?: (progress: number) => void;
}): Promise<ApiResponse<UploadImageResponse>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response: ApiResponse<UploadImageResponse>) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(response);
    };

    if (!appConfig.apiBaseUrl) {
      finish({
        success: false,
        data: null,
        error: {
          code: 'UPLOAD_CONFIG_MISSING',
          message: 'Missing EXPO_PUBLIC_API_BASE_URL for uploads.',
        },
      });
      return;
    }

    const formData = new FormData();
    formData.append('category', input.category);
    formData.append('width', String(input.image.width ?? ''));
    formData.append('height', String(input.image.height ?? ''));
    formData.append('file', {
      uri: input.image.uri,
      name: input.image.fileName ?? `${input.category}.jpg`,
      type: input.image.mimeType ?? 'image/jpeg',
    } as never);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${appConfig.apiBaseUrl}/uploads`);
    xhr.timeout = 45000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && input.onProgress) {
        input.onProgress(Math.min(event.loaded / event.total, 0.95));
      }
    };

    xhr.onerror = () => {
      finish({
        success: false,
        data: null,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Image upload failed.',
        },
      });
    };

    xhr.ontimeout = () => {
      finish({
        success: false,
        data: null,
        error: {
          code: 'UPLOAD_TIMEOUT',
          message: 'Image upload took too long. Please try again.',
        },
      });
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish({
          success: false,
          data: null,
          error: {
            code: 'UPLOAD_FAILED',
            message: 'Image upload failed.',
          },
        });
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as ApiResponse<UploadImageResponse>;
        finish(parsed);
      } catch {
        finish({
          success: false,
          data: null,
          error: {
            code: 'UPLOAD_RESPONSE_INVALID',
            message: 'Upload response could not be parsed.',
          },
        });
      }
    };

    xhr.onloadend = () => {
      if (!settled) {
        finish({
          success: false,
          data: null,
          error: {
            code: 'UPLOAD_INCOMPLETE',
            message: 'Image upload did not finish correctly. Please try again.',
          },
        });
      }
    };

    xhr.send(formData);
  });
}

export const apiUploadsService: UploadsService = {
  uploadImage(input) {
    return uploadWithProgress(input);
  },

  async deleteUpload(uploadId) {
    const response = await fetch(`${appConfig.apiBaseUrl}/uploads/${uploadId}`, {
      method: 'DELETE',
    });

    const parsed = (await response.json()) as ApiResponse<DeleteUploadResponse>;
    return parsed;
  },
};
