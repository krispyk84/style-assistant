import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { openAiClient } from '../../ai/openai-client.js';
import { styleGuideRepository } from './style-guide.repository.js';

type RetrievalTask =
  | 'outfit-generation'
  | 'trip-generation'
  | 'tier-regeneration'
  | 'compatibility-check'
  | 'selfie-review';

type RetrieveGuidanceInput = {
  task: RetrievalTask;
  query: string;
};

type RetrievalExcerpt = {
  score: number | null;
  text: string;
  filename?: string;
};

function trimExcerpt(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 700);
}

function formatPromptContext(excerpts: RetrievalExcerpt[]) {
  if (!excerpts.length) {
    return null;
  }

  return [
    'Retrieved style-guide guidance:',
    'Treat this as a strong editorial bias, not an absolute hard constraint.',
    ...excerpts.map((excerpt, index) => {
      const source = excerpt.filename ? ` [source: ${excerpt.filename}]` : '';
      return `${index + 1}. ${trimExcerpt(excerpt.text)}${source}`;
    }),
  ].join('\n');
}

export const styleGuideService = {
  async getActiveVectorStoreId() {
    if (env.STYLE_GUIDE_VECTOR_STORE_ID?.trim()) {
      return env.STYLE_GUIDE_VECTOR_STORE_ID.trim();
    }

    const activeDocument = await styleGuideRepository.findActive();
    return activeDocument?.vectorStoreId ?? null;
  },

  async retrieveGuidance(input: RetrieveGuidanceInput) {
    if (!env.STYLE_GUIDE_ENABLED) {
      return null;
    }

    const vectorStoreId = await this.getActiveVectorStoreId();
    if (!vectorStoreId) {
      return null;
    }

    try {
      const results = await openAiClient.searchVectorStore({
        vectorStoreId,
        query: input.query,
        maxResults: env.STYLE_GUIDE_MAX_RESULTS,
        scoreThreshold: env.STYLE_GUIDE_SCORE_THRESHOLD,
      });

      const excerpts = results
        .map((result) => ({
          score: typeof result.score === 'number' ? result.score : null,
          text: result.content.map((item) => item.text).join('\n').trim(),
          filename: result.filename,
        }))
        .filter((item) => item.text.length > 0);

      if (!excerpts.length) {
        return null;
      }

      return {
        task: input.task,
        vectorStoreId,
        excerpts,
        promptContext: formatPromptContext(excerpts),
      };
    } catch (error) {
      logger.warn(
        {
          task: input.task,
          error,
        },
        'Style guide retrieval failed; continuing without retrieved guidance'
      );

      return null;
    }
  },
};
