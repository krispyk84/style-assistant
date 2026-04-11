import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

const QUEUE_BASE = 'https://queue.fal.run/fal-ai/flux-lora';
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // 40 × 3 s = 120 s max

export async function submitToQueue(body: object): Promise<string> {
  const res = await fetch(QUEUE_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    logger.error({ statusCode: res.status, error: data?.detail ?? data?.error }, 'fal.ai queue submission failed');
    throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider could not start sketch generation.');
  }

  const requestId: string = data?.request_id;
  if (!requestId) {
    logger.error({ data }, 'fal.ai queue response missing request_id');
    throw new HttpError(502, 'FAL_IMAGE_INVALID', 'The AI provider returned an invalid queue response.');
  }

  return requestId;
}

export async function pollUntilDone(requestId: string): Promise<unknown> {
  const statusUrl = `${QUEUE_BASE}/requests/${requestId}/status`;
  const resultUrl = `${QUEUE_BASE}/requests/${requestId}`;

  for (let i = 0; i < MAX_POLLS; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${env.FAL_KEY}` },
    });

    const statusData = await statusRes.json().catch(() => null);
    const status: string = statusData?.status ?? '';

    if (status === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${env.FAL_KEY}` },
      });
      const result = await resultRes.json().catch(() => null);
      return result;
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      logger.error({ requestId, status, logs: statusData?.logs }, 'fal.ai flux-lora job failed');
      throw new HttpError(502, 'FAL_IMAGE_FAILED', 'The AI provider sketch generation failed.');
    }

    // IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new HttpError(504, 'FAL_IMAGE_TIMEOUT', 'The AI provider timed out while generating the sketch.');
}
