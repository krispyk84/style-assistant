import type { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger.js';

// Phase 3B2 (sync rollout gate) — minimal client-version telemetry. The
// Vesture frontend sends X-App-Version/X-App-Build on every request (see
// lib/app-version.ts's appVersionHeaders(), attached in
// lib/api/api-client.ts); this is the one place every backend-mediated
// request already passes through, so it's the natural place to record a
// sanitized version/build pair alongside the log line the app already
// emits — no new logging system, no payload/token content ever touched.
// Deliberately bounded and pattern-checked rather than logged verbatim: a
// header is fully attacker-controlled input (this endpoint has no auth
// requirement to even reach this middleware), so an unbounded or
// unvalidated value would let a caller inject arbitrary strings into the
// structured log.
const MAX_VERSION_HEADER_LENGTH = 32;
const VALID_VERSION_HEADER = /^[A-Za-z0-9._-]+$/;

function sanitizeVersionHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0) return 'unknown';
  const trimmed = raw.slice(0, MAX_VERSION_HEADER_LENGTH);
  return VALID_VERSION_HEADER.test(trimmed) ? trimmed : 'invalid';
}

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const startedAt = Date.now();
  const appVersion = sanitizeVersionHeader(request.headers['x-app-version']);
  const appBuild = sanitizeVersionHeader(request.headers['x-app-build']);

  response.on('finish', () => {
    logger.info({
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      appVersion,
      appBuild,
    });
  });

  next();
}
