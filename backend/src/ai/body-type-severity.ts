/**
 * BMI-derived severity calibration for sketch figure descriptions.
 *
 * Combines the user's height, weight, and selected body type to produce a
 * plain-English figure description and matching negative prompt that are
 * injected directly into the sketch generation prompt.
 *
 * Design intent:
 * - Higher BMI within a body type category = more pronounced rendering
 * - athletic at high BMI reads as powerfully built, NOT overweight
 * - oval at high BMI reads as very large and heavy, NOT athletic
 * - Falls back to a static description when height/weight are unavailable
 */

type SeverityResult = {
  description: string;
  negativePrompt: string;
};

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  slim: 'lean slight man, narrow frame, slim arms and legs, minimal muscle mass, slender torso',
  oval: 'large heavy-set man, overweight, full rounded belly protruding forward, wide torso, heavy arms and legs, clothing draped over a big frame',
  rectangle: 'average-build man, straight silhouette, shoulders and hips similar width, minimal waist definition, medium frame',
  athletic: 'muscular well-built man, defined arms and chest, visibly toned and fit, broad shoulders, tapered waist, strong physique',
};

const NEGATIVE_PROMPTS: Record<string, string> = {
  slim: 'muscular, heavy-set, overweight, thick, bulky',
  oval: 'slim, thin, athletic, toned, fit body, lean, muscular, narrow waist, flat stomach',
  rectangle: 'muscular, overweight, heavy-set, V-shaped torso',
  athletic: 'slim, thin, lean, overweight, fat, flabby, soft',
};

const FALLBACK_DEFAULT: SeverityResult = {
  description: 'average-build man, medium frame, moderate proportions',
  negativePrompt: '',
};

function bmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function severityForOval(bmiValue: number): string {
  if (bmiValue < 27) return 'slightly fuller build, mild roundness through the midsection, soft frame';
  if (bmiValue < 33) return 'noticeably heavy-set man, visible rounded belly, fuller frame throughout';
  if (bmiValue < 38) return 'large heavy-set man, prominent rounded belly, wide torso, heavy arms and legs';
  return 'very large heavy-set man, very prominent rounded belly, extremely heavy frame throughout, wide torso, heavy arms and legs, clothing visibly stretched and draped over a very big body';
}

function severityForAthletic(bmiValue: number): string {
  if (bmiValue < 24) return 'lean athletic man, defined but not bulky, fit and trim, visible muscle tone';
  if (bmiValue < 27) return 'athletic and solid man, visible muscle mass, fit and well-built, strong frame';
  if (bmiValue < 30) return 'powerfully built man, large muscular frame, thick arms and chest, visibly strong and heavy with muscle not fat';
  return 'very large muscular man, extremely broad and powerful frame, heavily built with dense muscle mass, big powerful man — muscle not fat, not overweight, not flabby';
}

function severityForRectangle(bmiValue: number): string {
  if (bmiValue < 22) return 'slim-average man, straight frame, minimal bulk, even proportions';
  if (bmiValue < 26) return 'average-build man, straight silhouette, shoulders and hips similar width, minimal waist definition';
  if (bmiValue < 30) return 'stocky straight-built man, heavier average build, solid wide frame';
  return 'heavy average-build man, wide straight frame, fuller throughout, substantial frame';
}

function severityForSlim(bmiValue: number): string {
  if (bmiValue < 19) return 'very lean slight man, minimal mass, narrow frame throughout, almost no bulk';
  if (bmiValue < 22) return 'lean slim man, light frame, minimal mass, slender arms and legs';
  if (bmiValue < 25) return 'slim man, light build, present but lean';
  return 'slim-leaning man, lighter build with slightly more presence than expected';
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
