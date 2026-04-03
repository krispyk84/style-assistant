import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { storageConfig } from '../../config/storage.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import { closetRepository } from './closet.repository.js';

const garmentDescriptionSchema = z.object({
  description: z.string(),
});

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  // Prefer reading directly from disk — faster and avoids self-HTTP requests on Render.
  const mediaPrefix = `${storageConfig.publicBaseUrl}/media/`;
  if (imageUrl.startsWith(mediaPrefix)) {
    const storageKey = imageUrl.slice(mediaPrefix.length);
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    try {
      const buffer = await fsPromises.readFile(filePath);
      const ext = path.extname(storageKey).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
      // File not on disk — fall through to HTTP fetch
    }
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image fetch failed with HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mimeType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
  return `data:${mimeType};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

async function describeGarmentFromImage(imageUrl: string): Promise<string> {
  const dataUrl = await imageUrlToDataUrl(imageUrl);

  const result = await openAiClient.createStructuredResponse({
    schema: garmentDescriptionSchema,
    jsonSchema: {
      name: 'garment_description',
      description: 'A concise but detailed description of the garment in the image',
      schema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A detailed description of the garment including colour, fabric, style, and key visual details. 1–2 sentences max.',
          },
        },
        required: ['description'],
        additionalProperties: false,
      },
    },
    instructions: 'You are a menswear expert. Describe the garment shown in the image concisely and accurately.',
    userContent: [
      { type: 'input_image', image_url: dataUrl, detail: 'high' },
      { type: 'input_text', text: 'Describe this garment in detail: colour, fabric, style, and key visual features.' },
    ],
  });

  return result.description;
}

async function runSketchGeneration(jobId: string, imageUrl: string) {
  try {
    const itemDescription = await describeGarmentFromImage(imageUrl);

    const generatedImage = await openAiClient.generateImage({
      prompt: buildClosetItemSketchPrompt({ itemDescription }),
      size: '1024x1536',
      quality: 'medium',
      outputFormat: 'jpeg',
    });

    // Store image data in DB only (not on the ephemeral filesystem) so sketches
    // survive server restarts. The /media/closet-sketch/:filename handler serves
    // directly from this DB record.
    const storageKey = `closet-sketch/${jobId}.jpg`;
    const sketchImageUrl = `${storageConfig.publicBaseUrl}/media/${storageKey}`;

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchImageUrl,
      sketchStorageKey: storageKey,
      sketchMimeType: generatedImage.mimeType,
      sketchImageData: generatedImage.data,
    });
  } catch (error) {
    logger.error({ jobId, error }, 'Closet item sketch generation failed');
    await closetRepository.updateSketchJob(jobId, {
      status: 'failed',
      sketchImageUrl: null,
      sketchStorageKey: null,
      sketchMimeType: null,
      sketchImageData: null,
    });
  }
}

export const closetSketchService = {
  async startSketchJob(imageUrl: string): Promise<string> {
    const job = await closetRepository.createSketchJob();
    void runSketchGeneration(job.id, imageUrl);
    return job.id;
  },

  async getSketchJobStatus(jobId: string) {
    const job = await closetRepository.getSketchJob(jobId);
    if (!job) return null;
    return {
      sketchStatus: job.status as 'pending' | 'ready' | 'failed',
      sketchImageUrl: job.sketchImageUrl ?? null,
    };
  },
};
