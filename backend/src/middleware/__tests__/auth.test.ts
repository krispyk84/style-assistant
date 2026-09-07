import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const getUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

const { requireAuth } = await import('../auth.js');

function buildReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function buildRes(): Response {
  const res = {} as Response;
  (res.status as unknown) = vi.fn().mockReturnValue(res);
  (res.json as unknown) = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('rejects a request with no Authorization header, without calling Supabase', async () => {
    const req = buildReq(undefined);
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects a malformed Authorization header (not "Bearer ...")', async () => {
    const req = buildReq('Basic abc123');
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects a token Supabase reports as invalid or expired', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    const req = buildReq('Bearer forged.or.expired.token');
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(getUser).toHaveBeenCalledWith('forged.or.expired.token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (fails closed) when the verification call itself throws', async () => {
    getUser.mockRejectedValue(new Error('network unreachable'));
    const req = buildReq('Bearer some.token.value');
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid, signature-verified token and attaches the verified user id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    const req = buildReq('Bearer good.token.value');
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(getUser).toHaveBeenCalledWith('good.token.value');
    expect(req.userId).toBe('user-123');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('never trusts a decoded sub claim without verification — a forged-but-well-formed JWT is rejected', async () => {
    // A locally-crafted, unsigned JWT with an arbitrary sub claim — this is
    // exactly the shape the old decode-only implementation would have
    // accepted. Supabase's real verification (mocked here as rejecting it)
    // must be what determines the outcome, not the presence of a `sub`.
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'someone-elses-user-id' })).toString('base64url');
    const forgedToken = `eyJhbGciOiJub25lIn0.${forgedPayload}.`;
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'signature verification failed' } });

    const req = buildReq(`Bearer ${forgedToken}`);
    const res = buildRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });
});
