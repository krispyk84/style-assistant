import { buildBaseAnalysisRules } from './base-stylist-rules.js';
import { formatProfileContext } from '../prompt-context.js';

type PromptProfile = Parameters<typeof formatProfileContext>[0];

export function buildCompatibilityInstructions() {
  return [
    ...buildBaseAnalysisRules(),
    'You are evaluating whether a candidate menswear piece fits a recommended outfit direction.',
    'Return only structured JSON matching the provided schema.',
    'Base the answer on the uploaded image when present, otherwise on the text context only.',
    'Verdicts must be one of: Works great, Works okay, Doesn’t work.',
    'Concerns and alternatives should be concrete, not generic.',
  ].join(' ');
}

export function buildCompatibilityUserPrompt(input: {
  profile: PromptProfile;
  outfitTitle?: string;
  anchorItemDescription?: string;
  tier?: string;
  pieceName?: string;
  imageFilename?: string;
  styleGuideContext?: string | null;
}) {
  return [
    formatProfileContext(input.profile),
    input.styleGuideContext ?? 'No retrieved style-guide guidance was available for this request.',
    'Candidate piece check:',
    `- outfitTitle: ${input.outfitTitle?.trim() || 'Not provided'}`,
    `- tier: ${input.tier?.trim() || 'Not provided'}`,
    `- anchorItemDescription: ${input.anchorItemDescription?.trim() || 'Not provided'}`,
    `- expectedPiece: ${input.pieceName?.trim() || 'Not provided'}`,
    `- imageFilename: ${input.imageFilename?.trim() || 'Not provided'}`,
    'Judge whether the uploaded piece supports the intended outfit recommendation.',
  ].join('\n');
}

export function buildSelfieReviewInstructions() {
  return [
    ...buildBaseAnalysisRules(),
    'You are reviewing a selfie of a menswear outfit against a previously recommended look.',
    'Return only structured JSON matching the provided schema.',
    'Base the answer on the uploaded selfie when present, otherwise on the text context only.',
    'Verdicts must be one of: Works great, Works okay, Doesn’t work.',
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
