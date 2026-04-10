import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { falClient } from './fal-client.js';
import { imagenClient } from './imagen-client.js';
import { geminiImageClient } from './gemini-image-client.js';
import type { GenerateImageInput } from './fal-client.js';

export type { GenerateImageInput };

/**
 * Provider-agnostic image generation router.
 *
 * Routes sketch generation to the configured provider based on IMAGE_PROVIDER:
 *
 *   IMAGE_PROVIDER=fal          → fal.ai Flux-LoRA (default, current production path)
 *   IMAGE_PROVIDER=imagen       → Google Imagen 4 on Vertex AI / AI Studio (text-only)
 *   IMAGE_PROVIDER=gemini-image → Gemini 2.5 Flash Image with visual style-reference
 *                                  conditioning (sends 3 Vesture sketch JPGs alongside
 *                                  the outfit description; style defined by images, not text)
 *
 * All providers accept the same GenerateImageInput and return { mimeType, data }.
 * Callers do not need to know which provider is active.
 *
 * Provider comparison:
 *   fal:          Custom Flux LoRA → consistent Vesture style via trigger words; $0.006/image
 *   imagen:       Base Imagen 4 + text style prompts; $0.04/image
 *   gemini-image: Gemini 2.5 Flash Image + visual style refs; ~$0.04/image
 *
 * To switch providers: set IMAGE_PROVIDER in .env / Render env and restart.
 */
export const imageGenerationClient = {
  generateImage(input: GenerateImageInput): Promise<{ mimeType: string; data: Buffer }> {
    // ─── Provider routing decision — always logged so it is explicitly verifiable ───
    // Check logs for: provider, loraType, fallbackUsed
    // IMAGE_PROVIDER env controls this; 'fal' is the default if unset.
    const provider = env.IMAGE_PROVIDER;
    logger.info(
      { provider, loraType: input.loraType, fallbackUsed: false },
      'Image generation provider selected'
    );

    if (provider === 'imagen') return imagenClient.generateImage(input);
    if (provider === 'gemini-image') return geminiImageClient.generateImage(input);
    return falClient.generateImage(input);
  },
};
