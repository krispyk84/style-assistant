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
    'Concerns and alternatives should be concrete, not generic.',
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
    "First identify the candidate piece from the image or candidateItem description. Then judge whether it is a viable substitute for the expectedPiece within this outfit context. If the candidate is a clearly different garment type or color family than the expectedPiece, return \u201cDoesn\u2019t work\u201d.",
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
    'Strengths, issues, and adjustments should evaluate silhouette, polish, and whether the result matches the original recommendation.',
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
    'Judge whether the outfit still captures the intended recommendation and flatters the wearer.',
  ].join('\n');
}
