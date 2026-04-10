import { env } from '../config/env.js';
import { falClient } from './fal-client.js';
import { imagenClient } from './imagen-client.js';
import type { GenerateImageInput } from './fal-client.js';

export type { GenerateImageInput };

/**
 * Provider-agnostic image generation router.
 *
 * Routes sketch generation to the configured provider based on IMAGE_PROVIDER:
 *
 *   IMAGE_PROVIDER=fal    → fal.ai Flux-LoRA (default, current production path)
 *   IMAGE_PROVIDER=imagen → Google Imagen on Vertex AI / AI Studio
 *
 * Both providers accept the same GenerateImageInput and return { mimeType, data }.
 * Callers (tier-sketch.service, closet-sketch.service) do not need to know which
 * provider is active — all provider-specific logic is encapsulated in each client.
 *
 * Provider comparison notes (for evaluation):
 *   fal:    Custom Flux LoRA → consistent Vesture illustration style; $0.006/image
 *   imagen: No LoRA, base Imagen 3 → different aesthetic; $0.04/image
 *           Style is guided by OUTFIT_STYLE_PREFIX / CLOSET_STYLE_PREFIX in imagen-client.ts
 *
 * To switch providers for a test run, set IMAGE_PROVIDER in your .env and restart.
 * No code changes required.
 */
export const imageGenerationClient = {
  generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    if (env.IMAGE_PROVIDER === 'imagen') {
      return imagenClient.generateImage(input);
    }
    return falClient.generateImage(input);
  },
};
