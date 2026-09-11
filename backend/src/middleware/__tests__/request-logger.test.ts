import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

// Phase 3B2 (sync rollout gate) — minimal client-version telemetry added to
// the existing per-request log line. Proves: a well-formed X-App-Version/
// X-App-Build pair is logged verbatim; a missing header logs 'unknown'; an
// oversized or non-version-shaped header logs 'invalid' rather than being
// passed through raw (this endpoint has no auth requirement, so the header
// is fully attacker-controlled input — never let it land unsanitized in a
// structured log).

const info = vi.fn();
vi.mock('../../config/logger.js', () => ({ logger: { info: (...args: unknown[]) => info(...args) } }));

const { requestLogger } = await import('../request-logger.js');

function buildReq(headers: Record<string, string | undefined>): Request {
  return { method: 'GET', path: '/closet-outfit-sync/favourites', headers } as unknown as Request;
}

function buildRes(): Response {
  const listeners: Record<string, () => void> = {};
  return {
    statusCode: 200,
    on: (event: string, cb: () => void) => {
      listeners[event] = cb;
    },
    // test-only helper to fire the 'finish' event
    _finish: () => listeners.finish?.(),
  } as unknown as Response & { _finish: () => void };
}

beforeEach(() => {
  info.mockReset();
});

describe('requestLogger — client-version telemetry', () => {
  it('logs a well-formed X-App-Version/X-App-Build pair verbatim', () => {
    const req = buildReq({ 'x-app-version': '1.4.0', 'x-app-build': '82' });
    const res = buildRes() as unknown as Response & { _finish: () => void };
    const next = vi.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res._finish();

    expect(next).toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ appVersion: '1.4.0', appBuild: '82' }));
  });

  it('logs "unknown" when the headers are absent (a pre-telemetry / legacy client)', () => {
    const req = buildReq({});
    const res = buildRes() as unknown as Response & { _finish: () => void };
    const next = vi.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res._finish();

    expect(info).toHaveBeenCalledWith(expect.objectContaining({ appVersion: 'unknown', appBuild: 'unknown' }));
  });

  it('logs "invalid" rather than passing an oversized/malformed header through raw', () => {
    const req = buildReq({ 'x-app-version': '<script>alert(1)</script>'.repeat(5), 'x-app-build': '1;DROP TABLE x' });
    const res = buildRes() as unknown as Response & { _finish: () => void };
    const next = vi.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res._finish();

    expect(info).toHaveBeenCalledWith(expect.objectContaining({ appVersion: 'invalid', appBuild: 'invalid' }));
  });

  it('never logs auth/payload content — only the fixed telemetry fields', () => {
    const req = buildReq({ 'x-app-version': '1.4.0', 'x-app-build': '82', authorization: 'Bearer super-secret-token' });
    const res = buildRes() as unknown as Response & { _finish: () => void };
    const next = vi.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res._finish();

    const loggedPayload = info.mock.calls[0][0];
    expect(JSON.stringify(loggedPayload)).not.toContain('super-secret-token');
  });
});
