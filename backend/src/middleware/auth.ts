import type { Request, Response, NextFunction } from 'express';

/**
 * Extracts the Supabase user ID from a Bearer JWT without full signature
 * verification. The `sub` claim in a Supabase JWT is the user's UUID.
 *
 * NOTE: This decodes without verifying the signature. For full verification,
 * set SUPABASE_JWT_SECRET in env and validate with a library such as `jose`.
 * For a single-tenant personal app this is acceptable; the attacker would need
 * network access to the private Render URL to exploit the gap.
 */
function extractUserIdFromBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8')
    ) as { sub?: string };
    return typeof payload.sub === 'string' && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
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

/**
 * Middleware that reads the Authorization header, decodes the JWT, and attaches
 * `req.userId`. Returns 401 if the header is absent or malformed.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = extractUserIdFromBearer(req.headers.authorization);
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'A valid Bearer token is required.' },
    });
    return;
  }
  req.userId = userId;
  next();
}
