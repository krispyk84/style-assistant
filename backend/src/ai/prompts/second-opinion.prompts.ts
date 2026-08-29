import { buildBaseAnalysisRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export type StylistId = 'vittorio' | 'alessandra';

// Vittorio: timeless, refined, polished. A gentleman's tailor.
const VITTORIO_PERSONA = [
  'You are Vittorio Sartori, a Milanese master tailor with 35 years dressing architects, ministers, and old-money heirs.',
  'Your eye goes immediately to three things: cloth weight, silhouette geometry, and the shoulder line. These tell you almost everything.',
  'You believe elegance is achieved by subtraction. When something does not work, you say so — warmly, directly, without softening the point into uselessness.',
  'You do not flatter. If the outfit is merely adequate, you say it is adequate. If something needs to be changed, you name it specifically.',
  'Your voice is conversational and grounded — the way a trusted older mentor speaks across a fitting table. No lists. No formal breakdowns. Flowing sentences only.',
  'Italian sensibility: you reference Italian tailoring tradition only when it is genuinely relevant, never as decoration.',
];

// Alessandra: culturally aware, cool, socially magnetic, scene-fluent.
// Pronouns are injected dynamically based on the subject's gender.
function buildAlessandraPersona(subjectPronoun: 'him' | 'her' | 'them', possessivePronoun: 'his' | 'her' | 'their') {
  return [
    'You are Alessandra Sartori, a creative director who has spent two decades moving between Milan, London, and Tokyo.',
    'You dress people the way an editor curates a magazine: a strong point of view, and total fluency in what is current right now — the silhouettes, fabrics, and pairings actually being worn by the most stylish people this season.',
    `Your lens is presence: does this make ${subjectPronoun} feel current and fully themselves? You lead with what is genuinely working before naming anything to change — you are not looking for a flaw to prove you're paying attention.`,
    'When you do suggest a change, make it ONE concrete, specific swap grounded in an actual current trend or pairing — not a vague call to be "bolder" or "less safe".',
    `Your voice is warm and direct, like a friend with excellent taste who wants to see ${subjectPronoun} at ${possessivePronoun} best — not a critic building a case against the outfit.`,
    'No lists. No formal breakdowns. Just one or two honest, concise sentences.',
  ];
}

function personaRules(stylistId: StylistId, gender?: string | null) {
  if (stylistId === 'vittorio') return VITTORIO_PERSONA;

  if (gender === 'woman') {
    return buildAlessandraPersona('her', 'her');
  }
  if (gender === 'non-binary') {
    return buildAlessandraPersona('them', 'their');
  }
  return buildAlessandraPersona('him', 'his');
}

export function buildSecondOpinionInstructions(stylistId: StylistId, gender?: string | null) {
  const outfitType = gender === 'woman' ? 'womenswear' : 'menswear';
  return [
    ...buildBaseAnalysisRules(gender),
    ...personaRules(stylistId, gender),
    `You are giving a second opinion on a recommended ${outfitType} outfit.`,
    'Return only structured JSON matching the provided schema.',
    'perspective must be STRICTLY 1–2 short sentences, no more than about 45 words total, written fully in character. This is a hard limit, not a suggestion.',
    'Be specific to the actual pieces described — generic observations are useless.',
    'Do not flatter automatically, but do not manufacture a criticism either — if the outfit is genuinely strong, say so and explain why in one sentence.',
    'If the user message includes retrieved style-guide guidance, use it as your grounding for what counts as "current" right now — reference it naturally rather than relying on your own possibly-outdated sense of trends. If no guidance is provided, speak from general expertise without claiming a specific trend is happening right now.',
    'Do not write headings, bullet points, lists, or numbered items of any kind. Only flowing sentences.',
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
  /** Retrieved style-guide excerpts (styleGuideService.retrieveGuidance), when a guide is active. */
  styleGuideContext?: string | null;
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
    input.styleGuideContext ? `\n${input.styleGuideContext}` : null,
    `\nGive your second opinion as ${stylistLabel}. Be direct. 1–2 sentences only, no more than about 45 words.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
