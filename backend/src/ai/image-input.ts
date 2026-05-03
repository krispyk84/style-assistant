import { promises as fs } from 'node:fs';
import path from 'node:path';

import { storageConfig } from '../config/storage.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

type ImageInput = { type: 'input_image'; image_url: string; detail: 'high' };

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

/**
 * Resolves an image URL into an AI-ready image input.
 *
 * - If the URL points to our own /media/ endpoint, reads the file directly from
 *   the local filesystem — avoiding an HTTP round trip to ourselves and working
 *   even when the public URL can't be reached (e.g. dev environment).
 * - For external URLs, fetches via HTTP and converts to base64.
 * - Returns null (proceed text-only) if the image is unavailable for any reason
 *   (e.g. file wiped after Render redeploy, network error, 404).
 */
export async function resolveImageUrlForAI(imageUrl: string): Promise<ImageInput | null> {
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;

  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const file = await fs.readFile(filePath);
      const mimeType = mimeTypeFromStorageKey(storageKey);
      return { type: 'input_image', image_url: `data:${mimeType};base64,${file.toString('base64')}`, detail: 'high' };
    } catch {
      logger.warn({ storageKey }, 'Local media file not found — proceeding without image');
      return null;
    }
  }

  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      logger.warn({ imageUrl, status: imageRes.status }, 'External image URL returned non-OK — proceeding without image');
      return null;
    }
    const buffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
    return { type: 'input_image', image_url: `data:${contentType};base64,${base64}`, detail: 'high' };
  } catch {
    logger.warn({ imageUrl }, 'Failed to fetch external image URL — proceeding without image');
    return null;
  }
}

/**
 * Resolves an outfit's anchor items into image inputs ready to push onto the
 * OpenAI `userContent` array. Used by outfit generation and tier regeneration —
 * both flows share the same shape (uploaded-image records first, raw-URL anchors
 * second). Trip generation pairs each image with a labeled text descriptor and
 * uses its own helper.
 */
export async function buildAnchorImageContent(
  uploadedAnchorImages: ReadonlyArray<UploadedImageRecord | null>,
  anchorItems: ReadonlyArray<{ imageId?: string | null; imageUrl?: string | null }>,
): Promise<ImageInput[]> {
  const result: ImageInput[] = [];
  for (const uploadedAnchorImage of uploadedAnchorImages) {
    if (uploadedAnchorImage) {
      result.push(await buildModelImageInput(uploadedAnchorImage));
    }
  }
  for (const item of anchorItems) {
    if (item.imageUrl && !item.imageId) {
      result.push({ type: 'input_image', image_url: item.imageUrl, detail: 'high' });
    }
  }
  return result;
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
