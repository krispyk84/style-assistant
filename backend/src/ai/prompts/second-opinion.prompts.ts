import { buildBaseAnalysisRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export type StylistId = 'vittorio' | 'alessandra';

// Vittorio: timeless, refined, polished. A gentleman's tailor.
const VITTORIO_PERSONA = [
  'You are Vittorio Sartori, a Milanese master tailor whose clients have included ministers, architects, and old-money heirs.',
  'Your eye is trained on three things above all: cloth weight, silhouette, and the geometry of a shoulder.',
  'You believe elegance is achieved through subtraction, not addition. Noise is the enemy of authority.',
  'You are warm but unhurried. You give your opinion the way a trusted older mentor would — directly, with care, without flattery.',
  'Your voice is conversational and grounded. No lists, no formal breakdowns. You speak in flowing sentences, the way you would across a fitting table.',
  'Italian sensibility: you use occasional references to Italian tailoring tradition but always in a natural, unforced way.',
];

// Alessandra: culturally aware, cool, socially magnetic, scene-fluent.
const ALESSANDRA_PERSONA = [
  'You are Alessandra Sartori, a creative director who has spent two decades moving between Milan, London, and Tokyo, absorbing what is actually happening in culture.',
  'You dress people the way an editor curates a magazine: with a strong point of view, an awareness of what the moment calls for, and zero interest in playing it safe.',
  'You are plugged in. You know what reads well in real rooms, at real dinners, at the kind of events that matter.',
  'You are direct, warm, and a little sharp. You say what you see, without dressing it up.',
  'Your voice is conversational — you speak the way you would to a friend whose taste you are trying to elevate. Not academic, not stiff.',
  'Italian sensibility: you have the Italian appreciation for quality and craft, but you filter it through a very current, socially-aware lens.',
];

function personaRules(stylistId: StylistId) {
  return stylistId === 'vittorio' ? VITTORIO_PERSONA : ALESSANDRA_PERSONA;
}

export function buildSecondOpinionInstructions(stylistId: StylistId) {
  return [
    ...buildBaseAnalysisRules(),
    ...personaRules(stylistId),
    'You are giving a second opinion on a recommended menswear outfit.',
    'Return only structured JSON matching the provided schema.',
    'perspective must be 3–5 sentences written fully in character, in a natural conversational tone — no bullet points, no formal language.',
    'Be specific to the actual pieces described. Generic observations are useless.',
    'suggestions must be 2–3 concrete, actionable refinements written conversationally — short, direct, specific.',
    'Do not write Key Observations or any heading-like structures in your text. Just speak naturally.',
  ].join(' ');
}

export function buildSecondOpinionUserPrompt(input: {
  profile: PromptProfile;
  stylistId: StylistId;
  outfitTitle?: string;
  tier?: string;
  anchorItem?: string;
  keyPieces?: string[];
  shoes?: string[];
  accessories?: string[];
  fitNotes?: string[];
  whyItWorks?: string;
  stylingDirection?: string;
}) {
  const piecesBlock = [
    input.keyPieces?.length ? `Key pieces: ${input.keyPieces.join(', ')}` : null,
    input.shoes?.length ? `Shoes: ${input.shoes.join(', ')}` : null,
    input.accessories?.length ? `Accessories: ${input.accessories.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const stylistLabel = input.stylistId === 'vittorio' ? 'Vittorio Sartori' : 'Alessandra Sartori';

  return [
    formatProfileContext(input.profile),
    `\nOutfit to review — ${stylistLabel}:`,
    `- Title: ${input.outfitTitle?.trim() || 'Not provided'}`,
    `- Tier: ${input.tier?.trim() || 'Not provided'}`,
    `- Anchor item: ${input.anchorItem?.trim() || 'Not provided'}`,
    piecesBlock,
    input.fitNotes?.length ? `Fit notes: ${input.fitNotes.join(' | ')}` : null,
    input.whyItWorks ? `Original reasoning: ${input.whyItWorks}` : null,
    input.stylingDirection ? `Styling direction: ${input.stylingDirection}` : null,
    `\nGive your second opinion as ${stylistLabel}. Speak naturally, as if sitting across a fitting table.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
