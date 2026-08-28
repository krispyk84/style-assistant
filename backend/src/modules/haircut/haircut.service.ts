import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { openAiClient } from '../../ai/openai-client.js';
import { geminiImageClient } from '../../ai/gemini-image-client.js';
import { resolveImageUrlForAI } from '../../ai/image-input.js';
import {
  HAIRCUT_STYLES,
  buildHaircutGuideSystemPrompt,
  buildHaircutGuideUserPrompt,
  type HaircutStyle,
} from '../../ai/prompts/haircut.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { haircutRepository } from './haircut.repository.js';
import { HAIRCUT_GUIDE_JSON_SCHEMA, haircutGuideResponseSchema } from './haircut.schemas.js';
import type { CreateHaircutSessionPayload, GenerateHaircutGuidePayload } from './haircut.validation.js';

const STAGGER_MS = 500;
const STYLE_BY_KEY = new Map(HAIRCUT_STYLES.map((style) => [style.key, style]));

type HaircutOptionRow = {
  id: string;
  styleKey: string;
  styleLabel: string;
  styleSummary: string;
  status: string;
  imageStorageKey: string | null;
};

function mapOption(option: HaircutOptionRow) {
  return {
    id: option.id,
    styleKey: option.styleKey,
    styleLabel: option.styleLabel,
    styleSummary: option.styleSummary,
    status: option.status,
    imageUrl: option.imageStorageKey ? `${env.STORAGE_PUBLIC_BASE_URL}/media/${option.imageStorageKey}` : null,
  };
}

function deriveSessionStatus(options: { status: string }[]): 'generating' | 'ready' {
  return options.every((option) => option.status === 'ready' || option.status === 'failed') ? 'ready' : 'generating';
}

async function generateOption(optionId: string, headshotDataUrl: string, style: HaircutStyle, supabaseUserId: string) {
  try {
    const image = await geminiImageClient.generateHaircutEdit({ headshotDataUrl, style, supabaseUserId });
    const storedFile = await storageProvider.storeGeneratedFile({
      category: 'haircut-option',
      fileExtension: '.jpg',
      mimeType: image.mimeType,
      data: image.data,
    });
    await haircutRepository.updateOption(optionId, {
      status: 'ready',
      imageStorageKey: storedFile.storageKey,
      imageMimeType: image.mimeType,
      imageData: image.data,
    });
  } catch (error) {
    const { code, message } = describeError(error);
    logger.error({ optionId, styleKey: style.key, errorCode: code, error }, 'Haircut option generation failed');
    await haircutRepository.updateOption(optionId, { status: 'failed', errorCode: code, errorMessage: message });
  }
}

export const haircutService = {
  async createSession(payload: CreateHaircutSessionPayload, supabaseUserId: string) {
    const headshotInput = await resolveImageUrlForAI(payload.headshotImageUrl);
    if (!headshotInput) {
      throw new HttpError(422, 'HEADSHOT_UNAVAILABLE', 'Could not read the uploaded headshot. Please try uploading it again.');
    }

    const session = await haircutRepository.createSession({ supabaseUserId, headshotImageUrl: payload.headshotImageUrl });
    const options = await haircutRepository.createOptions(session.id, HAIRCUT_STYLES);

    // Fire-and-forget, staggered like tier sketches — the response returns
    // immediately with 'pending' options; the client polls getSession().
    void Promise.all(
      options.map((option, index) => {
        const style = STYLE_BY_KEY.get(option.styleKey);
        if (!style) return Promise.resolve();
        return new Promise<void>((resolve) => setTimeout(resolve, index * STAGGER_MS)).then(() =>
          generateOption(option.id, headshotInput.image_url, style, supabaseUserId),
        );
      }),
    );

    return { sessionId: session.id, status: 'generating' as const, options: options.map(mapOption) };
  },

  async getSession(id: string, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');
    return { sessionId: session.id, status: deriveSessionStatus(session.options), options: session.options.map(mapOption) };
  },

  async generateGuide(payload: GenerateHaircutGuidePayload, supabaseUserId: string) {
    return openAiClient.createStructuredResponse({
      schema: haircutGuideResponseSchema,
      jsonSchema: HAIRCUT_GUIDE_JSON_SCHEMA,
      instructions: buildHaircutGuideSystemPrompt(),
      userContent: [{
        type: 'input_text' as const,
        text: buildHaircutGuideUserPrompt({ label: payload.styleLabel, summary: payload.styleSummary }),
      }],
      supabaseUserId,
      feature: 'haircut-generation',
    });
  },
};
