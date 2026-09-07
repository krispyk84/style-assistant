import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Verifies the bearer token against Supabase's own Auth server rather than
// decoding it locally — this is Supabase's supported verification mechanism
// and requires no assumption about which signing algorithm the project uses
// (legacy shared-secret vs. current asymmetric keys). A previous version of
// this file decoded the JWT's `sub` claim without checking its signature at
// all, which let a well-formed-but-forged token impersonate any user.
const supabaseAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

// Extend Express Request type so TypeScript knows about req.userId downstream.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const UNAUTHORIZED_RESPONSE = {
  success: false,
  error: { code: 'UNAUTHORIZED', message: 'A valid Bearer token is required.' },
} as const;

/**
 * Middleware that reads the Authorization header, verifies the JWT's
 * signature against Supabase, and attaches the verified `req.userId`.
 * Returns 401 for a missing header or any token that is malformed, expired,
 * or fails signature verification — the `sub` claim is never trusted before
 * that verification succeeds.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json(UNAUTHORIZED_RESPONSE);
    return;
  }

  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json(UNAUTHORIZED_RESPONSE);
      return;
    }
    req.userId = data.user.id;
    next();
  } catch (err) {
    // A thrown error here means the verification call itself failed (e.g.
    // Supabase unreachable) rather than the token being rejected — still
    // fail closed (never grant access on ambiguity), but log it separately
    // from an ordinary invalid-token rejection so an infra problem doesn't
    // masquerade as routine 401s in the logs.
    logger.error({ err }, 'Auth token verification request failed');
    res.status(401).json(UNAUTHORIZED_RESPONSE);
  }
}
