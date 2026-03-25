import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { buildClosetItemSketchPrompt } from '../../ai/prompts/sketch.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { closetRepository } from './closet.repository.js';

const garmentDescriptionSchema = z.object({
  description: z.string(),
});

async function describeGarmentFromImage(imageUrl: string): Promise<string> {
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
      { type: 'input_image', image_url: imageUrl, detail: 'high' },
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

    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'closet-sketch',
      fileExtension: '.jpg',
      mimeType: generatedImage.mimeType,
      data: generatedImage.data,
    });

    await closetRepository.updateSketchJob(jobId, {
      status: 'ready',
      sketchImageUrl: storedFile.publicUrl,
      sketchStorageKey: storedFile.storageKey,
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
