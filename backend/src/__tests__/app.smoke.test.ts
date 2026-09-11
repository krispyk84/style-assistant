import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from 'vitest';

// Real-runtime smoke test — deliberately mocks NOTHING. Every other test file
// under src/ mocks its module's own dependencies (e.g. middleware/__tests__/
// auth.test.ts mocks @supabase/supabase-js's createClient), which is correct
// for unit-testing that module's logic but means the mocked import is never
// actually exercised. That gap is exactly what let a real regression through:
// @supabase/supabase-js's createClient() unconditionally constructs a
// RealtimeClient, which throws synchronously on Node 20 without a `ws`
// transport passed in — this crashed every new Render instance on boot, but
// every unit test (and typecheck, and build) still passed, because the unit
// test's mock replaced createClient before that code ever ran for real.
//
// This file loads the real installed dependency graph (real
// @supabase/supabase-js, real `ws`, real Prisma client construction, every
// real Express router) and only checks that none of it throws during
// construction or a live request. It intentionally does NOT reach the
// database or Supabase's actual auth server — Prisma's client is lazy
// (connects on first query, not on construction) and the request below hits
// an unreachable dummy SUPABASE_URL, which is caught inside requireAuth's
// try/catch and surfaces as an ordinary 401, not a crash.
describe('createApp (real installed dependencies, no mocks)', () => {
  it('constructs the full app without throwing', async () => {
    // A dynamic import (not a top-level one) so this module — and everything
    // it transitively imports, including middleware/auth.ts's module-level
    // createClient(...) call — only ever runs inside this test's try/catch,
    // the same failure mode as the original Render crash-loop (a synchronous
    // throw during import/module-init, before any request is ever handled).
    const { createApp } = await import('../app.js');
    expect(() => createApp()).not.toThrow();
  });

  it('serves a real HTTP request end-to-end without binding the production port', async () => {
    const { createApp } = await import('../app.js');
    const app = createApp();

    // Mirrors src/index.ts's real bootstrap path (createServer(app) then
    // listen) but on an OS-assigned ephemeral port (0), so this never
    // collides with anything already listening on env.PORT.
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    try {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      // Phase 3B2: /health's syncCapabilities field is the client's
      // preflight signal that this deployed build's code includes the
      // Phase 1A/3B1 sync-protocol support it depends on.
      const healthBody = await health.json();
      expect(healthBody.data.syncCapabilities).toEqual({
        closetOutfitVersionedSync: true,
        closetOutfitLegacyCompatibilityBridge: true,
      });

      // Hits a real requireAuth-protected route with no Authorization header.
      // This exercises the full real middleware stack (helmet, cors, the
      // real supabaseAuthClient instance) for a live request, not just module
      // import — proving the app doesn't just construct but actually serves
      // traffic without crashing the process.
      const unauthenticated = await fetch(`${baseUrl}/api/closet/analyse`, { method: 'POST' });
      expect(unauthenticated.status).toBe(401);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
