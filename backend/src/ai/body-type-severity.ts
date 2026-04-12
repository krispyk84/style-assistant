/**
 * BMI-derived severity calibration for sketch figure descriptions.
 *
 * Uses concrete, visual, image-model-friendly language — no abstract phrases.
 * Diffusion models respond to specific physical descriptors ("thick massive arms")
 * not editorial concepts ("powerfully built frame"). Em-dashes avoided as they
 * break CLIP tokenization in Flux.
 */

type SeverityResult = {
  description: string;
  negativePrompt: string;
};

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  slim: 'slim lean man, narrow frame, slim arms and legs, light build',
  oval: 'large overweight man, visible rounded belly, wide torso, heavy arms and legs',
  rectangle: 'average-build man, straight silhouette, even proportions, medium frame',
  athletic: 'muscular man, broad shoulders, large arm muscles, wide chest, strong frame',
};

const NEGATIVE_PROMPTS: Record<string, string> = {
  slim: 'muscular, bulky, heavy, thick arms, wide shoulders, large build, overweight',
  oval: 'slim body, thin body, skinny, lean, toned, athletic, muscular, narrow waist, flat stomach, fashion model body, slim mannequin',
  rectangle: 'muscular, overweight, fat belly, very wide shoulders, slim, skinny',
  athletic: 'slim body, thin body, skinny, lean, slender, narrow frame, fashion model body, average build, slim mannequin, thin arms, narrow shoulders, small frame',
};

const FALLBACK_DEFAULT: SeverityResult = {
  description: 'average-build man, medium frame, moderate proportions',
  negativePrompt: '',
};

function bmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function severityForAthletic(bmiValue: number): string {
  if (bmiValue < 24) return 'lean athletic man, defined visible muscles, toned arms and shoulders, fit physique';
  if (bmiValue < 27) return 'athletic muscular man, visibly broad shoulders, large arm muscles, wide chest, strong solid frame';
  if (bmiValue < 30) return 'very muscular man, very broad shoulders, thick arms, large chest, big strong frame, large muscular figure';
  return 'extremely large and muscular man, very broad powerful shoulders, thick massive arms, massive chest, heavy muscular build, heavyweight powerlifter physique, NFL linebacker body, very wide frame, clothing stretched over enormous muscles';
}

function severityForOval(bmiValue: number): string {
  if (bmiValue < 27) return 'slightly overweight man, mild belly, soft midsection, slightly fuller frame';
  if (bmiValue < 33) return 'overweight man, visible rounded belly, heavy frame, fuller arms and legs, noticeably large build';
  if (bmiValue < 38) return 'large overweight man, prominent hanging belly, wide torso, heavy arms and thick legs, big man with substantial body mass';
  return 'very large obese man, very prominent large belly, extremely wide torso, heavy thick arms and legs, massive frame, clothing pulled tight and stretched over a very large body';
}

function severityForRectangle(bmiValue: number): string {
  if (bmiValue < 22) return 'slim-average man, straight frame, even proportions top to bottom, minimal bulk';
  if (bmiValue < 26) return 'average-build man, straight silhouette, similar shoulder and hip width, unremarkable proportions';
  if (bmiValue < 30) return 'stocky average man, wider solid frame, heavier build, straight silhouette with more bulk';
  return 'heavy stocky man, wide solid frame, thick torso, heavier arms and legs, substantial average build';
}

function severityForSlim(bmiValue: number): string {
  if (bmiValue < 19) return 'very thin slight man, very narrow frame, very slim arms and legs, minimal mass throughout';
  if (bmiValue < 22) return 'slim lean man, light build, narrow frame, slim arms and legs';
  if (bmiValue < 25) return 'slim man, light to medium frame, lean build';
  return 'slim to average man, light frame with some presence';
}

export function buildBodyTypeSeverity(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  bodyType: string | null | undefined,
): SeverityResult {
  const negativePrompt = (bodyType && NEGATIVE_PROMPTS[bodyType]) ?? '';

  // No body type set — neutral default
  if (!bodyType) {
    return FALLBACK_DEFAULT;
  }

  // Missing measurements — fall back to static description
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    return {
      description: FALLBACK_DESCRIPTIONS[bodyType] ?? FALLBACK_DEFAULT.description,
      negativePrompt,
    };
  }

  const bmiValue = bmi(heightCm, weightKg);
  let description: string;

  switch (bodyType) {
    case 'oval':
      description = severityForOval(bmiValue);
      break;
    case 'athletic':
      description = severityForAthletic(bmiValue);
      break;
    case 'rectangle':
      description = severityForRectangle(bmiValue);
      break;
    case 'slim':
      description = severityForSlim(bmiValue);
      break;
    default:
      description = FALLBACK_DESCRIPTIONS[bodyType] ?? FALLBACK_DEFAULT.description;
  }

  return { description, negativePrompt };
}
