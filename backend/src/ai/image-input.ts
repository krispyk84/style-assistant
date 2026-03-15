import { promises as fs } from 'node:fs';
import path from 'node:path';

import { storageConfig } from '../config/storage.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type UploadedImageRecord = {
  storageProvider: string;
  storageKey: string;
  mimeType: string | null;
  publicUrl: string;
};

function mimeTypeFromStorageKey(storageKey: string) {
  const extension = path.extname(storageKey).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/jpeg';
}

export async function buildModelImageInput(uploadedImage: UploadedImageRecord) {
  if (uploadedImage.storageProvider === 'local') {
    const filePath = path.join(storageConfig.localDirectory, uploadedImage.storageKey);

    try {
      const file = await fs.readFile(filePath);
      const mimeType = uploadedImage.mimeType ?? mimeTypeFromStorageKey(uploadedImage.storageKey);
      const base64 = file.toString('base64');

      return {
        type: 'input_image' as const,
        image_url: `data:${mimeType};base64,${base64}`,
        detail: 'high' as const,
      };
    } catch (error) {
      logger.error({ storageKey: uploadedImage.storageKey, error }, 'Unable to read uploaded image for AI request');
      throw new HttpError(500, 'UPLOAD_READ_FAILED', 'The uploaded image could not be prepared for analysis.');
    }
  }

  return {
    type: 'input_image' as const,
    image_url: uploadedImage.publicUrl,
    detail: 'high' as const,
  };
}
