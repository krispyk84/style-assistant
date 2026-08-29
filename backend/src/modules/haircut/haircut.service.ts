import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { openAiClient } from '../../ai/openai-client.js';
import { geminiImageClient } from '../../ai/gemini-image-client.js';
import { resolveImageUrlForAI } from '../../ai/image-input.js';
import {
  HAIRCUT_ANGLES,
  HAIRCUT_STYLES,
  INITIAL_BATCH_SIZE,
  MORE_BATCH_SIZE,
  buildHaircutGuideSystemPrompt,
  buildHaircutGuideUserPrompt,
  type HaircutAngle,
  type HaircutStyle,
} from '../../ai/prompts/haircut.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { haircutTrendsService } from '../haircut-trends/haircut-trends.service.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import { haircutRepository } from './haircut.repository.js';
import { HAIRCUT_GUIDE_JSON_SCHEMA, haircutGuideResponseSchema } from './haircut.schemas.js';
import type { CreateHaircutSessionPayload, GenerateHaircutGuidePayload, SaveHaircutSessionPayload } from './haircut.validation.js';

const STAGGER_MS = 500;

/**
 * The style list a session draws from: the current seasonal top-20 trend
 * list (a mix of classic + trending cuts, refreshed periodically via Gemini)
 * when available, falling back to the fixed 12-style curated list when no
 * hemisphere is known or no trend profile has been generated yet/Gemini is
 * unreachable — mirrors the "stale/missing profile never blocks the feature"
 * principle used by the outfit seasonal-trends system.
 */
async function resolveActiveStyles(hemisphere?: string | null): Promise<HaircutStyle[]> {
  if (!hemisphere) return HAIRCUT_STYLES;
  const trendData = await haircutTrendsService.getCurrentTrendProfile(hemisphere as Hemisphere);
  if (!trendData) return HAIRCUT_STYLES;
  const styles = trendData.profile.styles as unknown as { key: string; label: string; summary: string }[];
  if (!Array.isArray(styles) || styles.length === 0) return HAIRCUT_STYLES;
  return styles.map((s) => ({ key: s.key, label: s.label, summary: s.summary }));
}

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

async function generateAngleOption(
  optionId: string,
  haircutImageDataUrl: string,
  style: HaircutStyle,
  angle: HaircutAngle,
  supabaseUserId: string,
) {
  try {
    const image = await geminiImageClient.generateHaircutAngleShot({ haircutImageDataUrl, style, angle, supabaseUserId });
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
    logger.error({ optionId, styleKey: style.key, angle, errorCode: code, error }, 'Haircut angle shot generation failed');
    await haircutRepository.updateOption(optionId, { status: 'failed', errorCode: code, errorMessage: message });
  }
}

export const haircutService = {
  async createSession(payload: CreateHaircutSessionPayload, supabaseUserId: string) {
    const headshotInput = await resolveImageUrlForAI(payload.headshotImageUrl);
    if (!headshotInput) {
      throw new HttpError(422, 'HEADSHOT_UNAVAILABLE', 'Could not read the uploaded headshot. Please try uploading it again.');
    }

    const activeStyles = await resolveActiveStyles(payload.hemisphere);
    const session = await haircutRepository.createSession({
      supabaseUserId,
      headshotImageUrl: payload.headshotImageUrl,
      hemisphere: payload.hemisphere,
      region: payload.region,
    });
    const options = await haircutRepository.createOptions(session.id, activeStyles.slice(0, INITIAL_BATCH_SIZE));

    // Fire-and-forget, staggered like tier sketches — the response returns
    // immediately with 'pending' options; the client polls getSession().
    void Promise.all(
      options.map((option, index) => {
        const style: HaircutStyle = { key: option.styleKey, label: option.styleLabel, summary: option.styleSummary };
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

  async addMoreOptions(id: string, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');

    const activeStyles = await resolveActiveStyles(session.hemisphere);
    const usedKeys = new Set(session.options.map((option) => option.styleKey));
    const nextStyles = activeStyles.filter((style) => !usedKeys.has(style.key)).slice(0, MORE_BATCH_SIZE);
    if (nextStyles.length === 0) {
      throw new HttpError(422, 'NO_MORE_STYLES', 'No more haircut styles left to try for this photo.');
    }

    const headshotInput = await resolveImageUrlForAI(session.headshotImageUrl);
    if (!headshotInput) {
      throw new HttpError(422, 'HEADSHOT_UNAVAILABLE', 'Could not read the uploaded headshot. Please try uploading it again.');
    }

    const newOptions = await haircutRepository.createOptions(id, nextStyles);

    void Promise.all(
      newOptions.map((option, index) => {
        const style: HaircutStyle = { key: option.styleKey, label: option.styleLabel, summary: option.styleSummary };
        return new Promise<void>((resolve) => setTimeout(resolve, index * STAGGER_MS)).then(() =>
          generateOption(option.id, headshotInput.image_url, style, supabaseUserId),
        );
      }),
    );

    return { sessionId: id, status: 'generating' as const, options: [...session.options, ...newOptions].map(mapOption) };
  },

  async generateAngleShots(id: string, optionId: string, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');

    const chosen = session.options.find((option) => option.id === optionId);
    if (!chosen || chosen.status !== 'ready') {
      throw new HttpError(422, 'OPTION_NOT_READY', 'That haircut is not ready yet.');
    }

    const haircutImageUrl = mapOption(chosen).imageUrl;
    if (!haircutImageUrl) throw new HttpError(422, 'OPTION_NOT_READY', 'That haircut is not ready yet.');

    const haircutInput = await resolveImageUrlForAI(haircutImageUrl);
    if (!haircutInput) {
      throw new HttpError(422, 'HEADSHOT_UNAVAILABLE', 'Could not read the chosen haircut photo. Please try again.');
    }

    const style: HaircutStyle = { key: chosen.styleKey, label: chosen.styleLabel, summary: chosen.styleSummary };
    const angleStyles: HaircutStyle[] = HAIRCUT_ANGLES.map(({ angle, label }) => ({
      key: `${chosen.styleKey}::${angle}`,
      label,
      summary: chosen.styleSummary,
    }));

    const angleOptions = await haircutRepository.createOptions(id, angleStyles);

    void Promise.all(
      angleOptions.map((option, index) => {
        const angle = HAIRCUT_ANGLES[index]!.angle;
        return new Promise<void>((resolve) => setTimeout(resolve, index * STAGGER_MS)).then(() =>
          generateAngleOption(option.id, haircutInput.image_url, style, angle, supabaseUserId),
        );
      }),
    );

    const mappedAngles = angleOptions.map(mapOption);
    return {
      sessionId: id,
      front: mapOption(chosen),
      frontAngled: mappedAngles[0]!,
      side: mappedAngles[1]!,
      back: mappedAngles[2]!,
    };
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

  async saveSession(id: string, payload: SaveHaircutSessionPayload, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');

    const chosen = session.options.find((option) => option.id === payload.optionId);
    if (!chosen || chosen.status !== 'ready') {
      throw new HttpError(422, 'OPTION_NOT_READY', 'That haircut is not ready yet.');
    }

    await haircutRepository.saveSession(id, supabaseUserId, { chosenOptionId: payload.optionId, guideData: payload.guide });
    return { sessionId: id, saved: true as const };
  },

  async unsaveSession(id: string, supabaseUserId: string) {
    await haircutRepository.unsaveSession(id, supabaseUserId);
    return { sessionId: id, saved: false as const };
  },

  async listSavedSessions(supabaseUserId: string) {
    const sessions = await haircutRepository.listSavedSessions(supabaseUserId);
    return sessions.flatMap((session) => {
      const chosen = session.options.find((option) => option.id === session.chosenOptionId);
      if (!chosen || !session.guideData || !session.savedAt) return [];

      const angleFor = (angle: HaircutAngle) => {
        const option = session.options.find((o) => o.styleKey === `${chosen.styleKey}::${angle}`);
        return option ? mapOption(option) : null;
      };
      const frontAngled = angleFor('front-angled');
      const side = angleFor('side');
      const back = angleFor('back');

      return [{
        sessionId: session.id,
        styleLabel: chosen.styleLabel,
        savedAt: session.savedAt.toISOString(),
        option: mapOption(chosen),
        angleShots: frontAngled && side && back ? { frontAngled, side, back } : null,
        guide: session.guideData,
      }];
    });
  },
};
