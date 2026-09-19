import { promises as fs } from 'node:fs';

import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { usageService } from '../usage/usage.service.js';

// ── "Ask a Stylist" voice-brief transcription ────────────────────────────────
//
// Reuses the app's existing OpenAI account/key (same as every other AI call
// in this app — openai-client.ts's dispatch() hits the same OPENAI_BASE_URL
// via plain fetch) via OpenAI's separate /v1/audio/transcriptions endpoint,
// which speaks multipart/form-data rather than the JSON body the structured-
// response helpers use — hence a small dedicated fetch here instead of going
// through openai-client.ts. No new provider, no new credentials.
//
// The recording is transcribed and immediately discarded — audio is never
// persisted to storage, matching the "don't persist raw audio indefinitely"
// requirement. The caller (route) is responsible for deleting multer's temp
// file in a finally block regardless of outcome.

// Flat per-request cost estimate (OpenAI's per-minute audio pricing isn't
// something this service can know without probing the file) — good enough
// for the AI-usage dashboard to reflect that a call happened; not intended
// as a precise billing reconciliation.
const ESTIMATED_COST_USD_PER_CLIP = 0.006;

type TranscribeInput = {
  filePath: string;
  originalFilename: string;
  mimetype: string;
  supabaseUserId: string;
};

export const stylistBriefService = {
  async transcribe({ filePath, originalFilename, mimetype, supabaseUserId }: TranscribeInput): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const formData = new FormData();
    formData.append('model', env.OPENAI_TRANSCRIPTION_MODEL);
    formData.append('file', new Blob([fileBuffer], { type: mimetype }), originalFilename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENAI_TRANSCRIPTION_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${env.OPENAI_BASE_URL}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(504, 'TRANSCRIPTION_TIMEOUT', 'The transcription took too long. Please try again or type your brief.');
      }
      throw new HttpError(502, 'TRANSCRIPTION_UNAVAILABLE', 'Could not reach the transcription service. Please try again or type your brief.');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new HttpError(502, 'TRANSCRIPTION_FAILED', 'The recording could not be transcribed. Please try again or type your brief.');
    }

    const data = (await response.json()) as { text?: string };
    const text = data.text?.trim() ?? '';

    usageService.record({
      supabaseUserId,
      feature: 'stylist-brief-transcription',
      model: env.OPENAI_TRANSCRIPTION_MODEL,
      costUsd: ESTIMATED_COST_USD_PER_CLIP,
    });

    return text;
  },
};
