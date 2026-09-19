import { z } from 'zod';

import { openAiClient } from '../../ai/openai-client.js';
import type { OutfitTierSlug } from '../../contracts/outfits.contracts.js';

// ── "Ask a Stylist" tier inference ───────────────────────────────────────────
//
// The conversational stylist flow has no explicit formality picker — the
// user just describes what they're dressing for. But the outfit-generation
// rule engine (required categories, layering, closet-only shortlists) is all
// keyed on a fixed business/smart-casual/casual tier, decided server-side
// BEFORE the shortlist/prompt scaffolding is built — it can't be inferred as
// a side effect of the same generation call. This is a small, dedicated
// classification step that runs first, reusing the same structured-response
// primitive as every other AI call in this app (no new provider).

const inferredTierSchema = z.object({
  tier: z.enum(['business', 'smart-casual', 'casual']),
});

const INSTRUCTIONS = [
  'You classify a short natural-language styling brief into exactly one formality tier for an outfit-generation system.',
  'The three tiers:',
  '- business: office, interview, formal client meeting, black-tie-adjacent, or any occasion calling for a suit/blazer-level of formality.',
  '- smart-casual: elevated but relaxed — a nice restaurant, a date, drinks somewhere with a dress code, a wedding guest look that is not black-tie.',
  '- casual: everyday, relaxed hangouts, casual drinks with friends, running errands, weekend wear.',
  'Read the brief for occasion, venue, and any explicit formality language, and pick the single best-fitting tier. If the brief is ambiguous, default to smart-casual — it is the safest middle ground.',
  'Return only structured JSON matching the schema.',
].join(' ');

/**
 * Classifies a stylist brief into one of the app's three fixed formality
 * tiers. Cheap, single structured call — not persisted, not user-visible.
 */
export async function inferStylistBriefTier(stylistBrief: string, supabaseUserId: string): Promise<OutfitTierSlug> {
  const result = await openAiClient.createStructuredResponse({
    schema: inferredTierSchema,
    jsonSchema: {
      name: 'stylist_brief_tier',
      description: 'The single formality tier that best fits a natural-language stylist brief.',
      schema: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['business', 'smart-casual', 'casual'] },
        },
        required: ['tier'],
        additionalProperties: false,
      },
    },
    instructions: INSTRUCTIONS,
    userContent: [{ type: 'input_text', text: `Stylist brief: "${stylistBrief.trim()}"` }],
    supabaseUserId,
    feature: 'stylist-tier-inference',
  });

  return result.tier;
}
