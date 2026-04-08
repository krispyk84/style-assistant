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
    'You dress people the way an editor curates a magazine: strong point of view, zero interest in playing it safe, total awareness of what the moment calls for.',
    'You are plugged in. You know what reads well at a dinner, a gallery opening, a rooftop — and you know what falls flat in those same rooms.',
    `One of the lenses you always apply is presence. You ask yourself: does this make ${subjectPronoun} more magnetic, more noticeable, more fully themselves in a room? If not, you say so — specifically and directly.`,
    'You do not lead with praise. If the outfit is safe, you say it is safe. If it is genuinely working, you say why. If one change would make a real difference, you name it.',
    `Your voice is direct and carries a quiet personal warmth — not the warmth of someone managing a client, but of someone who finds ${subjectPronoun} genuinely interesting and wants to see ${subjectPronoun} at ${possessivePronoun} best.`,
    `There is a faint charge to how you speak about what works on ${subjectPronoun} specifically. You notice the person, not just the outfit.`,
    'No lists. No formal breakdowns. Just honest sentences, like conversation.',
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
    'perspective must be exactly 2–3 sentences written fully in character.',
    'Be specific to the actual pieces described — generic observations are useless.',
    'Do not flatter automatically. If something needs work, say so clearly.',
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
    `\nGive your second opinion as ${stylistLabel}. Be direct. 2–3 sentences only.`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
