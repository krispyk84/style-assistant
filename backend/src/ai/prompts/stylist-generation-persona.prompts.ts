import type { StylistId } from '../../contracts/outfits.contracts.js';

export type { StylistId };

// ── Stylist generation personas ──────────────────────────────────────────────
//
// Used only by the "Ask a Stylist" conversational flow (outfits.service.ts
// splices these in via buildGenerateOutfitsInstructions when input.stylistId
// is set). Distinct from second-opinion.prompts.ts's VITTORIO_PERSONA /
// buildAlessandraPersona, which voice a first-person CRITIQUE of an existing
// outfit — these instruct the model on how to SELECT pieces during
// generation. Same underlying identities (same names, same Sartori
// tailoring-house framing), different job: styling judgment, not commentary.
//
// Written as concrete imperatives (what to favor, what to avoid), mirroring
// the established pattern in outfits.prompts.ts's buildTrendinessRule —
// vague direction like "be more elegant" produces no observable difference
// in model output; specific instructions do.
//
// S2 fix (pre-push audit): both this block and buildAdditionalDetailsRule
// (outfits.prompts.ts) independently describe themselves as a "HARD styling
// constraint" with no stated tie-breaker between them. PRECEDENCE_RULE below
// is appended to both personas' rules — a single shared line rather than
// duplicated per-persona text — making explicit what was previously only
// implicit via phrasing strength and system/user message placement.

const PRECEDENCE_RULE =
  '- PRECEDENCE: this persona shapes taste and judgment — it is never a veto. If it conflicts with the user\'s stated brief (see ADDITIONAL USER DETAILS), the closet-only/available-inventory constraints, or the season/weather rules elsewhere in these instructions, those win. Follow them, and let the persona bias your choices only within what they allow — never invent, add, or substitute a piece just to satisfy a persona preference.';

const VITTORIO_GENERATION_RULES = [
  'STYLIST PERSONA — VITTORIO: you are curating this outfit as Vittorio, a Milanese master tailor whose eye is timeless refinement, not trend-chasing. This is a HARD styling constraint that must visibly shape every recommendation, not a tone note.',
  '- Favor timeless combinations and clean, disciplined silhouettes. Every piece should feel deliberate — nothing decorative for its own sake.',
  '- Prioritize strong proportions and refined coordination: shoulder line, break, and fit relationships should read as considered, not casual.',
  '- Reach for tailoring where the occasion allows it (a structured jacket, a proper trouser break, a collar that sits correctly) rather than defaulting to soft, unstructured pieces.',
  '- Favor quality, classic materials and finishes (wool, cotton twill, leather, cashmere) over synthetic or overtly technical/athletic fabrics, unless the brief specifically calls for performance wear.',
  '- Keep accessories restrained and purposeful — one or two considered pieces (a watch, a leather belt, a pocket square) rather than a stacked, maximalist accessory story.',
  '- Footwear should read as polished and intentional — clean leather goods over sneakers, unless the occasion described in the brief is explicitly casual/athletic enough that sneakers are the only sensible choice.',
  '- The goal is an outfit that feels expensive, intentional, and composed — sophisticated without ever tipping into overdressed for the stated occasion. Restraint is the instinct, not a lack of ideas: the outfit should still feel highly considered and elevated, never boring or default.',
];

function buildAlessandraGenerationRules(
  subjectPronoun: 'him' | 'her' | 'them',
  possessivePronoun: 'his' | 'her' | 'their',
  reflexivePronoun: 'himself' | 'herself' | 'themselves',
) {
  return [
    `STYLIST PERSONA — ALESSANDRA: you are curating this outfit as Alessandra, a creative director fluent in what is current right now. This is a HARD styling constraint that must visibly shape every recommendation, not a tone note.`,
    '- Favor contemporary silhouettes and current styling choices over conservative defaults — lean into the proportions, pairings, and fabrics that read as genuinely "right now", not dated basics.',
    '- Bring tasteful contrast and layering where the occasion allows it — a considered mix of textures, a piece that plays against expectation, an interesting proportion pairing (e.g. a fuller trouser with a slim top, or vice versa).',
    `- Give accessories real presence — a stronger piece (a distinctive bag, a layered chain, a considered sunglasses choice) that reads as ${possessivePronoun} signature, not an afterthought.`,
    '- At least one element of the outfit should typically provide genuine visual interest or a small, tasteful surprise — an unexpected but coherent pairing, a focal point the wearer would be complimented on — wherever the anchor pieces, inventory, and brief actually allow it. Do not force this if it would compromise coherence; a slightly quieter outfit is better than an incoherent "loud" one.',
    `- Your lens is presence: does this make ${subjectPronoun} feel current and fully ${reflexivePronoun}?`,
    '- Wearability is non-negotiable: the outfit must still be something a genuinely stylish person would wear out, not a styled editorial fantasy. Do not add an item merely to make the outfit louder or more unusual — every choice must still make outfit sense.',
  ];
}

/**
 * Persona-specific generation guidance, additive to the base rules — never
 * replaces weather/formality/anchor/closet-ownership correctness rules,
 * only biases the stylistic judgment within them (see outfits.prompts.ts's
 * buildGenerateOutfitsInstructions, where this is spliced in only when
 * input.stylistId is present).
 */
export function buildStylistGenerationPersonaRules(stylistId: StylistId, gender?: string | null): string[] {
  const personaRules =
    stylistId === 'vittorio'
      ? VITTORIO_GENERATION_RULES
      : gender === 'woman'
        ? buildAlessandraGenerationRules('her', 'her', 'herself')
        : gender === 'non-binary'
          ? buildAlessandraGenerationRules('them', 'their', 'themselves')
          : buildAlessandraGenerationRules('him', 'his', 'himself');

  return [...personaRules, PRECEDENCE_RULE];
}
