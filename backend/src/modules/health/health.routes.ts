import { Router } from 'express';

import { env } from '../../config/env.js';
import { sendSuccess } from '../../lib/api-response.js';

export const healthRouter = Router();

// Phase 3B2 (sync rollout gate) — a static declaration of which sync-
// protocol capabilities THIS deployed backend build's code includes, not a
// live probe of Supabase/database state (that would be service discovery,
// out of scope here). Bumped by hand in the same commit that introduces
// each capability, mirroring how a client would check "does this feature
// exist in this build" against a version number. The currently-deployed
// production backend (as of this commit) predates all of Phase 1A/3A/3B1 —
// it has neither field at all, which is exactly the signal a version-aware
// client's capability preflight needs: a missing field means "this server
// predates sync support," not "sync is broken."
const SYNC_CAPABILITIES = {
  // Phase 1A: version-aware create/update/delete for closet-outfit
  // favourites and week-plan, backend-mediated (Prisma), reconciliation-read
  // endpoints included.
  closetOutfitVersionedSync: true,
  // Phase 3B1: legacy (currently-installed-app) mutations against these
  // same two domains now advance sync_version and soft-delete instead of
  // silently drifting/physically deleting.
  closetOutfitLegacyCompatibilityBridge: true,
} as const;

healthRouter.get('/health', (_request, response) =>
  sendSuccess(response, {
    status: 'ok',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    syncCapabilities: SYNC_CAPABILITIES,
  })
);
