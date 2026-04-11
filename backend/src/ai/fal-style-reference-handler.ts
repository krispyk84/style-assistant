import { env } from '../config/env.js';
import { OUTFIT_STYLE_REFS } from './style-refs-data.js';
import type { GenerateImageInput } from './fal-types.js';

// img2img conditioning strengths:
// Closet — higher strength preserves garment structural geometry from the source photo.
// Outfit — lower strength lets LoRA + prompt dominate content; ref conditions aesthetic register only.
const CLOSET_IMG2IMG_STRENGTH = 0.45;
const OUTFIT_STYLE_REF_STRENGTH = 0.35;

/**
 * Returns a publicly-accessible URL for one of the 3 Vesture style-reference
 * sketches, served by the backend itself via /style-refs/:index.jpg.
 *
 * FAL fetches this URL as the img2img base image (strength 0.2) so the
 * reference contributes its palette, texture, and background feel while the
 * LoRA + text prompt drive the outfit content.
 *
 * Returns null when STORAGE_PUBLIC_BASE_URL is not https:// (local dev) —
 * FAL cannot reach localhost, so we skip style conditioning silently.
 */
function pickStyleRefUrl(): string | null {
  const base = env.STORAGE_PUBLIC_BASE_URL;
  if (!base.startsWith('https://')) return null;
  const index = Math.floor(Math.random() * OUTFIT_STYLE_REFS.length);
  return `${base}/style-refs/${index}.jpg`;
}

export function buildImg2ImgParams(input: GenerateImageInput): { params: Record<string, unknown>; styleRefUsed: boolean } {
  const isCloset = input.loraType === 'closet';
  const params: Record<string, unknown> = isCloset
    ? (input.sourceImageUrl?.startsWith('https://')
        ? { image_url: input.sourceImageUrl, strength: CLOSET_IMG2IMG_STRENGTH }
        : {})
    : (() => {
        const styleRefUrl = pickStyleRefUrl();
        return styleRefUrl ? { image_url: styleRefUrl, strength: OUTFIT_STYLE_REF_STRENGTH } : {};
      })();

  const styleRefUsed = !isCloset && 'image_url' in params;
  return { params, styleRefUsed };
}
