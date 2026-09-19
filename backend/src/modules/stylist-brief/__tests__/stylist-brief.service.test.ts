import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { stylistBriefService } from '../stylist-brief.service.js';

// ── What this file is ───────────────────────────────────────────────────────
//
// Voice input for "Ask a Stylist": proves the transcription request hits
// OpenAI's separate /v1/audio/transcriptions endpoint (not the chat-
// completions path openai-client.ts's structured-response helpers use),
// carries the app's existing OPENAI_API_KEY (no new provider/credentials),
// and that a transcription failure surfaces as a typed HttpError rather than
// an unhandled rejection — since a failure here must never block the user
// from typing their brief instead.

let tempFile: string;

beforeEach(async () => {
  tempFile = path.join(os.tmpdir(), `stylist-brief-test-${Date.now()}.m4a`);
  await fs.writeFile(tempFile, Buffer.from([0, 1, 2, 3]));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(tempFile, { force: true });
});

describe('stylistBriefService.transcribe', () => {
  it('posts to /v1/audio/transcriptions with the configured model and the app’s existing API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Drinks with friends, keep it relaxed.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const text = await stylistBriefService.transcribe({
      filePath: tempFile,
      originalFilename: 'brief.m4a',
      mimetype: 'audio/m4a',
      supabaseUserId: 'user-1',
    });

    expect(text).toBe('Drinks with friends, keep it relaxed.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/v1/audio/transcriptions');
    expect(options.headers.Authorization).toBe('Bearer test-openai-key');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('throws a typed error when OpenAI returns a non-2xx response, rather than resolving with garbage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(
      stylistBriefService.transcribe({
        filePath: tempFile,
        originalFilename: 'brief.m4a',
        mimetype: 'audio/m4a',
        supabaseUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ statusCode: 502, code: 'TRANSCRIPTION_FAILED' });
  });

  it('returns an empty string (not a throw) when OpenAI reports no detected speech', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: '' }) }));

    const text = await stylistBriefService.transcribe({
      filePath: tempFile,
      originalFilename: 'brief.m4a',
      mimetype: 'audio/m4a',
      supabaseUserId: 'user-1',
    });

    expect(text).toBe('');
  });
});
