import { buildBaseAnalysisRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export function buildCompatibilityInstructions(gender?: string | null) {
  const fashionContext = gender === 'woman' ? 'womenswear' : 'menswear';
  return [
    ...buildBaseAnalysisRules(gender),
    `You are evaluating whether a candidate ${fashionContext} piece is a viable substitute for the expectedPiece in a recommended outfit.`,
    'Return only structured JSON matching the provided schema.',
    'Base your assessment of the candidate on the uploaded image when present, otherwise on the candidateItem description.',
    "Verdicts must be one of: Works great, Works okay, Doesn\u2019t work.",
    "CRITICAL: Your primary task is substitution judgement. If the candidate differs materially from the expectedPiece in garment type, color family, or formality tier, it must receive \u201cDoesn\u2019t work\u201d or at most \u201cWorks okay\u201d \u2014 never \u201cWorks great\u201d unless it genuinely serves the same role in the outfit. An olive field jacket cannot substitute for a navy blazer. A stone overshirt cannot substitute for a dress shirt.",
    'Your response has two independent scores:',
    '  itemMatch — how closely the candidate resembles the expectedPiece itself (garment type, color family, formality tier). Strong = nearly identical; Moderate = same category but notable difference; Weak = different garment type or color family.',
    '  outfitFit — how well the candidate works within the full outfit context, regardless of similarity. A piece can be a weak match yet still fit the outfit acceptably if it shares the right formality and color palette.',
    'summary: 1–2 sentences giving the overall verdict rationale.',
    'outfitImpact: up to 3 specific, concrete notes on how the candidate changes the outfit (silhouette, formality, color balance, etc.). Not generic platitudes.',
  ].join(' ');
}

export function buildCompatibilityUserPrompt(input: {
  profile: PromptProfile;
  outfitTitle?: string;
  anchorItemDescription?: string;
  tier?: string;
  pieceName?: string;
  candidateItemDescription?: string;
  imageFilename?: string;
  styleGuideContext?: string | null;
}) {
  return [
    formatProfileContext(input.profile),
    input.styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Substitution check:',
    `- outfitTitle: ${input.outfitTitle?.trim() || 'Not provided'}`,
    `- tier: ${input.tier?.trim() || 'Not provided'}`,
    `- anchorItemDescription: ${input.anchorItemDescription?.trim() || 'Not provided'}`,
    `- expectedPiece: ${input.pieceName?.trim() || 'Not provided'}`,
    `- candidateItem: ${input.candidateItemDescription?.trim() || 'Identified from uploaded image'}`,
    `- imageFilename: ${input.imageFilename?.trim() || 'Not provided'}`,
    'First identify the candidate piece from the image or candidateItem description.',
    'Then score itemMatch by comparing the candidate directly to the expectedPiece (garment type, color, formality).',
    'Then score outfitFit by judging how well the candidate works within the full outfit (independent of how similar it is to the expectedPiece).',
    'Set verdict to: "Works great" only if both itemMatch and outfitFit are Strong; "Doesn\'t work" if itemMatch is Weak or outfitFit is Weak; "Works okay" otherwise.',
    'Write summary and outfitImpact to explain your reasoning concretely.',
  ].join('\n');
}

export function buildSelfieReviewInstructions(gender?: string | null) {
  const fashionContext = gender === 'woman' ? 'womenswear' : 'menswear';
  return [
    ...buildBaseAnalysisRules(gender),
    `You are reviewing a selfie of a ${fashionContext} outfit against a previously recommended look.`,
    'Return only structured JSON matching the provided schema.',
    'Base the answer on the uploaded selfie when present, otherwise on the text context only.',
    "Verdicts must be one of: Works great, Works okay, Doesn\u2019t work.",
    'Your response has two independent scores:',
    '  lookFidelity — how closely the worn outfit follows the original recommendation. Close = nearly identical; Adjusted = same spirit but noticeable substitutions; Different = significantly diverged from the recommendation.',
    '  overallLook — how well the result works as a complete outfit, regardless of whether it matches the recommendation. Strong = polished and cohesive; Moderate = works but has room for improvement; Weak = silhouette, formality, or color balance issues.',
    'summary: 1–2 sentences giving the overall verdict rationale.',
    'substitutionImpact: up to 3 specific, concrete notes on how any substitutions or deviations from the recommendation changed the final look. Omit if the worn outfit closely follows the recommendation.',
  ].join(' ');
}

export function buildSelfieReviewUserPrompt(input: {
  profile: PromptProfile;
  outfitTitle?: string;
  anchorItemDescription?: string;
  tier?: string;
  imageFilename?: string;
  styleGuideContext?: string | null;
}) {
  return [
    formatProfileContext(input.profile),
    input.styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Selfie review target:',
    `- outfitTitle: ${input.outfitTitle?.trim() || 'Not provided'}`,
    `- tier: ${input.tier?.trim() || 'Not provided'}`,
    `- anchorItemDescription: ${input.anchorItemDescription?.trim() || 'Not provided'}`,
    `- imageFilename: ${input.imageFilename?.trim() || 'Not provided'}`,
    'Score lookFidelity based on how closely the worn outfit matches the recommendation (piece types, colors, formality).',
    'Score overallLook based on how the outfit looks on the wearer as a finished look — silhouette, polish, cohesion.',
    'Set verdict to: "Works great" if overallLook is Strong; "Doesn\'t work" if overallLook is Weak; "Works okay" otherwise.',
    'Write summary and substitutionImpact to explain your reasoning concretely.',
  ].join('\n');
}
