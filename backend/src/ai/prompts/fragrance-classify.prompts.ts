import { z } from 'zod';

import type { JsonSchemaConfig } from '../openai-request-builder.js';

// ── Item-kind classification ─────────────────────────────────────────────────
//
// The FIRST step of a type-aware Add Closet Item flow: before any garment or
// fragrance-specific processing runs, decide what the uploaded photo actually
// is. Deliberately minimal — this does NOT attempt to extract the full
// fragrance profile (that's a separate structured call, fragrance-profile
// .prompts.ts, run only once fragrance mode is confirmed) — it only answers
// "what is this item?" so the Add Closet Item screen can route to the right
// form. A low-confidence or 'unknown' result must never silently force the
// user into either form; the caller falls back to the existing manual
// "This is a fragrance" toggle.

export const CLASSIFY_ITEM_KIND_CONFIDENCE_THRESHOLD = 0.7;

const itemKindResponseSchema = z.object({
  itemKind: z.enum(['garment', 'fragrance', 'unknown']),
  confidence: z.number().min(0).max(1),
  // Best-effort only, fragrance itemKind only — the real, validated profile
  // comes from a separate fragrance-profile.prompts.ts call, not from here.
  fragranceBrandGuess: z.string().optional(),
  fragranceNameGuess: z.string().optional(),
});

export type ItemKindResponse = z.infer<typeof itemKindResponseSchema>;

export { itemKindResponseSchema };

const INSTRUCTIONS = [
  'You classify a single photographed closet item into exactly one kind: "garment" (clothing, footwear, bags, jewelry, sunglasses, or any other wearable) or "fragrance" (a cologne, perfume, or fragrance bottle) or "unknown" if you cannot tell.',
  'Return a confidence from 0.0 to 1.0 reflecting how sure you are.',
  'Only return "fragrance" when the image clearly shows a fragrance bottle, atomizer, or fragrance packaging — not merely because something looks glass or bottle-shaped.',
  'If the item is a fragrance and you can make out a brand or product name from the label, return your best-effort fragranceBrandGuess/fragranceNameGuess — these are NOT authoritative and will be independently re-verified, so include them whenever you have any reasonable read on the label, even if not fully certain.',
  'If you cannot confidently tell what kind of item this is, return "unknown" with a low confidence rather than guessing.',
  'Return only structured JSON matching the schema.',
].join(' ');

export function buildClassifyItemKindPrompt(): {
  instructions: string;
  jsonSchema: JsonSchemaConfig;
} {
  return {
    instructions: INSTRUCTIONS,
    jsonSchema: {
      name: 'item_kind_classification',
      description: 'Whether a photographed closet item is a garment, a fragrance, or unknown',
      schema: {
        type: 'object',
        properties: {
          itemKind: { type: 'string', enum: ['garment', 'fragrance', 'unknown'] },
          confidence: { type: 'number', description: '0.0 to 1.0' },
          fragranceBrandGuess: { type: 'string', description: 'Best-effort only, fragrance itemKind only' },
          fragranceNameGuess: { type: 'string', description: 'Best-effort only, fragrance itemKind only' },
        },
        required: ['itemKind', 'confidence'],
        additionalProperties: false,
      },
    },
  };
}
