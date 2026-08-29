import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError, describeError } from '../../lib/http-error.js';
import { runWithConcurrencyLimit } from '../../lib/concurrency-limit.js';
import { openAiClient } from '../../ai/openai-client.js';
import { geminiImageClient } from '../../ai/gemini-image-client.js';
import { resolveImageUrlForAI } from '../../ai/image-input.js';
import {
  HAIRCUT_ANGLES,
  HAIRCUT_STYLES,
  HAIRCUT_STYLES_WOMENSWEAR,
  INITIAL_BATCH_SIZE,
  MORE_BATCH_SIZE,
  buildHaircutGuideSystemPrompt,
  buildHaircutGuideUserPrompt,
  type HaircutAngle,
  type HaircutStyle,
} from '../../ai/prompts/haircut.prompts.js';
import { storageProvider } from '../../storage/index.js';
import { profileRepository } from '../profile/profile.repository.js';
import { haircutTrendsService } from '../haircut-trends/haircut-trends.service.js';
import type { FashionGender } from '../seasonal-trends/seasonal-trends.repository.js';
import type { Hemisphere } from '../seasonal-trends/season-math.js';
import { haircutRepository } from './haircut.repository.js';
import { HAIRCUT_GUIDE_JSON_SCHEMA, haircutGuideResponseSchema } from './haircut.schemas.js';
import type { CreateHaircutSessionPayload, GenerateHaircutGuidePayload, SaveHaircutSessionPayload } from './haircut.validation.js';

// Bounds actual concurrent generations (not just start times) — each Gemini
// image-edit call holds a full image buffer in memory for its duration, and
// a simple stagger only spaces out *start* times, not overlap. Too much real
// concurrency across sessions is exactly what tripped the server's memory
// limit on the trend-sketch side; mirrored here for the same protection.
const GENERATION_CONCURRENCY = 3;

// A pending/failed angle-shot option older than this is treated as abandoned
// rather than still legitimately in flight — most commonly because a server
// restart killed an in-flight generation (that work only ever existed in
// memory) — and becomes eligible for retryStuckAngleShots() to pick up.
const STALE_MS = 1000 * 60 * 10;

// Each unsaved session carries up to ~20 HaircutOption rows with real JPEG
// blobs — far heavier per-row than tiered outfit history — so this stays
// deliberately smaller than HISTORY_RETENTION_LIMIT (50) in outfits.service.ts.
// Saved sessions (savedAt set) are never counted against this limit at all.
export const HAIRCUT_SESSION_RETENTION_LIMIT = 10;

function fashionGenderForProfile(profile: { gender?: string | null } | null | undefined): FashionGender {
  return profile?.gender === 'woman' ? 'womenswear' : 'menswear';
}

function fallbackStylesFor(fashionGender: FashionGender): HaircutStyle[] {
  return fashionGender === 'womenswear' ? HAIRCUT_STYLES_WOMENSWEAR : HAIRCUT_STYLES;
}

/**
 * The style list a session draws from: the current seasonal top-20 trend
 * list for this fashionGender (a mix of classic + trending cuts, refreshed
 * periodically via Gemini) when available, falling back to the fixed
 * 12-style curated list for that gender when no hemisphere is known or no
 * trend profile has been generated yet/Gemini is unreachable — mirrors the
 * "stale/missing profile never blocks the feature" principle used by the
 * outfit seasonal-trends system.
 */
async function resolveActiveStyles(hemisphere: string | null | undefined, fashionGender: FashionGender): Promise<HaircutStyle[]> {
  const fallback = fallbackStylesFor(fashionGender);
  if (!hemisphere) return fallback;
  const trendData = await haircutTrendsService.getCurrentTrendProfile(fashionGender, hemisphere as Hemisphere);
  if (!trendData) return fallback;
  const styles = trendData.profile.styles as unknown as { key: string; label: string; summary: string }[];
  if (!Array.isArray(styles) || styles.length === 0) return fallback;
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

    const profile = await profileRepository.findByUserId(supabaseUserId);
    const fashionGender = fashionGenderForProfile(profile);
    const activeStyles = await resolveActiveStyles(payload.hemisphere, fashionGender);
    const session = await haircutRepository.createSession({
      supabaseUserId,
      headshotImageUrl: payload.headshotImageUrl,
      hemisphere: payload.hemisphere,
      region: payload.region,
      fashionGender,
    });
    const options = await haircutRepository.createOptions(session.id, activeStyles.slice(0, INITIAL_BATCH_SIZE));

    // Fire-and-forget, bounded-concurrency like trend sketches — the response
    // returns immediately with 'pending' options; the client polls getSession().
    void runWithConcurrencyLimit(options, GENERATION_CONCURRENCY, (option) => {
      const style: HaircutStyle = { key: option.styleKey, label: option.styleLabel, summary: option.styleSummary };
      return generateOption(option.id, headshotInput.image_url, style, supabaseUserId);
    });

    // Fire-and-forget with .catch() — an unawaited rejection here is an
    // unhandled promise rejection, which crashes the whole process (this
    // exact failure mode already happened once this session for outfit
    // history pruning; never repeat it).
    haircutService.pruneUnsavedSessions(supabaseUserId).catch((error) => {
      logger.error({ supabaseUserId, error }, 'Haircut session prune failed');
    });

    return { sessionId: session.id, status: 'generating' as const, options: options.map(mapOption) };
  },

  /**
   * Deletes this user's unsaved haircut sessions beyond HAIRCUT_SESSION_RETENTION_LIMIT.
   * Saved sessions are excluded from the candidate set at the query level, not
   * just skipped by ordering, so a saved session can never be deleted here.
   */
  async pruneUnsavedSessions(supabaseUserId: string, keep: number = HAIRCUT_SESSION_RETENTION_LIMIT) {
    const staleIds = await haircutRepository.findUnsavedSessionIdsBeyondLimit(supabaseUserId, keep);
    if (staleIds.length === 0) return 0;
    return haircutRepository.deleteSessionsByIds(staleIds);
  },

  async getSession(id: string, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');
    return { sessionId: session.id, status: deriveSessionStatus(session.options), options: session.options.map(mapOption) };
  },

  async addMoreOptions(id: string, supabaseUserId: string) {
    const session = await haircutRepository.getSession(id, supabaseUserId);
    if (!session) throw new HttpError(404, 'NOT_FOUND', 'Haircut session not found.');

    // Sessions created before the fashionGender snapshot was added have no
    // stored value — fall back to deriving it fresh from the profile so
    // "see more" never breaks for pre-existing sessions.
    const fashionGender = (session.fashionGender as FashionGender | null)
      ?? fashionGenderForProfile(await profileRepository.findByUserId(supabaseUserId));
    const activeStyles = await resolveActiveStyles(session.hemisphere, fashionGender);
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

    void runWithConcurrencyLimit(newOptions, GENERATION_CONCURRENCY, (option) => {
      const style: HaircutStyle = { key: option.styleKey, label: option.styleLabel, summary: option.styleSummary };
      return generateOption(option.id, headshotInput.image_url, style, supabaseUserId);
    });

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

    void runWithConcurrencyLimit(angleOptions, GENERATION_CONCURRENCY, (option, index) => {
      const angle = HAIRCUT_ANGLES[index]!.angle;
      return generateAngleOption(option.id, haircutInput.image_url, style, angle, supabaseUserId);
    });

    const mappedAngles = angleOptions.map(mapOption);
    return {
      sessionId: id,
      front: mapOption(chosen),
      top: mappedAngles[0]!,
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
      const top = angleFor('top');
      const side = angleFor('side');
      const back = angleFor('back');

      return [{
        sessionId: session.id,
        styleLabel: chosen.styleLabel,
        savedAt: session.savedAt.toISOString(),
        option: mapOption(chosen),
        angleShots: top && side && back ? { top, side, back } : null,
        guide: session.guideData,
      }];
    });
  },

  /**
   * Server-side self-healing sweep — retries any angle-shot HaircutOption
   * stuck pending/failed for longer than STALE_MS, reconstructing the
   * generation input from the "front" option in the same session (the
   * angle option itself only stores the angle's own label, not the original
   * haircut style label/photo). Run periodically by the trend refresh
   * scheduler, independent of any live session view.
   */
  async retryStuckAngleShots() {
    const stuck = await haircutRepository.findStuckAngleOptions(new Date(Date.now() - STALE_MS));
    // Always logged, unconditionally — the only way to tell "the sweep ran
    // and found nothing" apart from "the sweep never ran at all" from logs.
    logger.info({ stuckCount: stuck.length }, 'Haircut angle shot retry sweep: ran');
    if (stuck.length === 0) return;

    await runWithConcurrencyLimit(stuck, GENERATION_CONCURRENCY, async (option) => {
      const separatorIndex = option.styleKey.lastIndexOf('::');
      if (separatorIndex === -1) return; // not actually an angle option — shouldn't happen given the query filter
      const frontStyleKey = option.styleKey.slice(0, separatorIndex);
      const angle = option.styleKey.slice(separatorIndex + 2) as HaircutAngle;

      const front = option.session.options.find((o) => o.styleKey === frontStyleKey && o.status === 'ready');
      if (!front?.imageStorageKey) {
        logger.error({ optionId: option.id }, 'Haircut angle shot retry: original haircut photo unavailable, cannot retry');
        return;
      }

      const haircutImageUrl = `${env.STORAGE_PUBLIC_BASE_URL}/media/${front.imageStorageKey}`;
      const haircutInput = await resolveImageUrlForAI(haircutImageUrl);
      if (!haircutInput) {
        logger.error({ optionId: option.id }, 'Haircut angle shot retry: could not resolve original haircut photo');
        return;
      }

      const style: HaircutStyle = { key: front.styleKey, label: front.styleLabel, summary: front.styleSummary };
      await generateAngleOption(option.id, haircutInput.image_url, style, angle, option.session.supabaseUserId);
    });
  },
};
