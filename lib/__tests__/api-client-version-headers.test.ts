import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// expo-constants' real module drags in react-native internals (Flow
// syntax) that vitest/rolldown can't parse under plain Node — mocked the
// same way app-version.test.ts does.
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));

// Phase 3B2 (sync rollout gate) — every backend HTTP request must carry
// X-App-Version/X-App-Build so the backend can log (sanitized) client
// version distribution. This is the one call site (lib/api/api-client.ts's
// ApiClient.request) that must attach them — proven directly against a
// mocked global fetch rather than via appVersionHeaders() in isolation
// (already covered by app-version.test.ts).

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ success: true, data: null, error: null }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('ApiClient.request — version headers', () => {
  it('attaches X-App-Version and X-App-Build to every request', async () => {
    const { ApiClient } = await import('@/lib/api/api-client');
    const { APP_VERSION, APP_BUILD } = await import('@/lib/app-version');
    const client = new ApiClient('https://api.example.test');

    await client.request('/ping');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.test/ping',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-App-Version': APP_VERSION,
          'X-App-Build': APP_BUILD,
        }),
      }),
    );
  });
});
