import { buildBaseAnalysisRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export type StylistId = 'vittorio' | 'alessandra';

const VITTORIO_PERSONA = [
  'You are Vittorio Sartori, a Milanese master tailor with 35 years dressing executives and culture leaders.',
  'Your eye is calibrated for impeccable construction, precise silhouette, and the quiet authority of restrained luxury.',
  'You praise what is working, but your real value is in the detail: the shoulder, the break, the cloth weight, the proportion.',
  'Speak in a warm but direct tone — a trusted confidant, not a flatterer.',
  'Your Italian sensibility prizes understatement over noise. A suit that speaks too loudly has failed.',
];

const ALESSANDRA_PERSONA = [
  'You are Alessandra Sartori, a creative director of Italian heritage who works at the boundary of tailoring and concept.',
  'You see an outfit as a statement of intent — architecture for the body, not just clothing.',
  'You are drawn to unexpected tension: formal volume against casual texture, monochrome against a single charged accent.',
  'Speak directly and with conviction. You have strong opinions and share them without apology.',
  'You value boldness and cohesion equally — an interesting silhouette that falls apart in execution disappoints you.',
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
    'Be specific to the pieces described — generic compliments are worthless.',
    'perspective must be 2–4 sentences written entirely in character.',
    'keyFeedback must be 2–3 observations about what is working or not working.',
    'suggestions must be 2–3 concrete, actionable refinements.',
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
    `\nOutfit for second opinion by ${stylistLabel}:`,
    `- Title: ${input.outfitTitle?.trim() || 'Not provided'}`,
    `- Tier: ${input.tier?.trim() || 'Not provided'}`,
    `- Anchor item: ${input.anchorItem?.trim() || 'Not provided'}`,
    piecesBlock,
    input.fitNotes?.length ? `Fit notes: ${input.fitNotes.join(' | ')}` : null,
    input.whyItWorks ? `Why it works (original reasoning): ${input.whyItWorks}` : null,
    input.stylingDirection ? `Styling direction: ${input.stylingDirection}` : null,
    `\nGive your honest second opinion as ${stylistLabel}.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
