/**
 * BMI-derived severity calibration for sketch figure descriptions.
 *
 * Uses concrete, visual, image-model-friendly language — no abstract phrases.
 * Diffusion models respond to specific physical descriptors ("thick massive arms")
 * not editorial concepts ("powerfully built frame"). Em-dashes avoided as they
 * break CLIP tokenization in Flux.
 *
 * IMPORTANT: All descriptions use body-proportion nouns ("build", "physique",
 * "figure") rather than identity nouns ("man", "person"). Identity nouns at
 * prompt slot 1 activate full-human rendering priors before the headless guard
 * at slot 0 has established the figure type — causing faces to be rendered.
 *
 * gender parameter is required to disambiguate body types shared by both genders:
 * "slim" and "rectangle" exist in both men's and women's option sets and render
 * with different proportions for each.
 */

type SeverityResult = {
  description: string;
  negativePrompt: string;
};

// ── Men's fallback descriptions ────────────────────────────────────────────────

const FALLBACK_DESCRIPTIONS_MEN: Record<string, string> = {
  slim: 'slim lean build, narrow frame, slim arms and legs, light physique',
  oval: 'large overweight build, visible rounded belly, wide torso, heavy arms and legs',
  rectangle: 'average build, straight silhouette, even proportions, medium frame',
  athletic: 'muscular athletic build, broad shoulders, large arm muscles, wide chest, strong frame',
};

const NEGATIVE_PROMPTS_MEN: Record<string, string> = {
  slim: 'muscular, bulky, heavy, thick arms, wide shoulders, large build, overweight',
  oval: 'slim body, thin body, skinny, lean, toned, athletic, muscular, narrow waist, flat stomach, fashion model body, slim mannequin',
  rectangle: 'muscular, overweight, fat belly, very wide shoulders, slim, skinny',
  athletic: 'slim body, thin body, skinny, lean, slender, narrow frame, fashion model body, average build, slim mannequin, thin arms, narrow shoulders, small frame',
};

// ── Women's fallback descriptions ──────────────────────────────────────────────

const FALLBACK_DESCRIPTIONS_WOMEN: Record<string, string> = {
  hourglass: 'classic hourglass build, balanced curves, defined waist, equal shoulder and hip width',
  inverted_triangle: 'inverted triangle build, broader shoulders than hips, strong upper body, narrower lower body',
  rectangle: 'straight female build, balanced proportions, minimal waist definition, similar shoulder and hip width',
  pear: 'pear build, narrower shoulders than hips, fuller thighs and hips, slim upper body',
  apple: 'apple build, fuller rounded midsection, slimmer legs and hips, weight carried through the torso',
  slim: 'slim female build, light and lean frame, gently curved proportions',
};

const NEGATIVE_PROMPTS_WOMEN: Record<string, string> = {
  hourglass: 'shapeless build, no waist definition, straight rectangular silhouette, equal shoulder hip and waist width, boxy frame, no curves',
  inverted_triangle: 'narrow shoulders, equal shoulder and hip width, pear shape, wide hips, slim upper body',
  rectangle: 'hourglass curves, defined waist, wide hips, pear shape, full curves',
  pear: 'equal hip and shoulder width, straight silhouette, slim hips, narrow lower body, inverted triangle build, athletic shoulders',
  apple: 'defined waist, slim waist, hourglass figure, pear shape, slim midsection, flat stomach, narrow torso',
  slim: 'heavy build, overweight, wide frame, large proportions, full figure, plus-size proportions',
};

const FALLBACK_DEFAULT: SeverityResult = {
  description: 'average build, medium frame, moderate proportions',
  negativePrompt: '',
};

// ── BMI helper ────────────────────────────────────────────────────────────────

function bmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

// ── Men's severity functions ──────────────────────────────────────────────────

function severityForAthletic(bmiValue: number): string {
  if (bmiValue < 24) return 'lean athletic build, defined visible muscles, toned arms and shoulders, fit physique';
  if (bmiValue < 27) return 'athletic muscular build, visibly broad shoulders, large arm muscles, wide chest, strong solid frame';
  if (bmiValue < 30) return 'very muscular build, very broad shoulders, thick arms, large chest, big strong frame, large muscular physique';
  return 'extremely large and muscular build, very broad powerful shoulders, thick massive arms, massive chest, heavy muscular physique, heavyweight powerlifter proportions, NFL linebacker frame, very wide build, clothing stretched over enormous muscles';
}

function severityForOval(bmiValue: number): string {
  if (bmiValue < 27) return 'slightly overweight build, mild belly, soft midsection, slightly fuller frame';
  if (bmiValue < 33) return 'overweight build, visible rounded belly, heavy frame, fuller arms and legs, noticeably large physique';
  if (bmiValue < 38) return 'large overweight build, prominent hanging belly, wide torso, heavy arms and thick legs, big physique with substantial body mass';
  return 'very large obese build, very prominent large belly, extremely wide torso, heavy thick arms and legs, massive frame, clothing pulled tight and stretched over a very large body';
}

function severityForRectangleMen(bmiValue: number): string {
  if (bmiValue < 22) return 'slim-average build, straight frame, even proportions top to bottom, minimal bulk';
  if (bmiValue < 26) return 'average build, straight silhouette, similar shoulder and hip width, unremarkable proportions';
  if (bmiValue < 30) return 'stocky average build, wider solid frame, heavier physique, straight silhouette with more bulk';
  return 'heavy stocky build, wide solid frame, thick torso, heavier arms and legs, substantial average physique';
}

function severityForSlimMen(bmiValue: number): string {
  if (bmiValue < 19) return 'very thin slight build, very narrow frame, very slim arms and legs, minimal mass throughout';
  if (bmiValue < 22) return 'slim lean build, light physique, narrow frame, slim arms and legs';
  if (bmiValue < 25) return 'slim build, light to medium frame, lean physique';
  return 'slim to average build, light frame with some presence';
}

// ── Women's severity functions ────────────────────────────────────────────────

function severityForHourglass(bmiValue: number): string {
  if (bmiValue < 22) return 'lean hourglass build, balanced narrow shoulders and hips, visibly defined waist, slim elegant proportions throughout';
  if (bmiValue < 28) return 'classic hourglass build, full balanced curves, clearly defined waist, equal shoulder and hip width, rounded feminine proportions';
  return 'fuller hourglass build, generous rounded curves throughout, very defined waist relative to hips and chest, full and rounded figure';
}

function severityForInvertedTriangle(bmiValue: number): string {
  if (bmiValue < 22) return 'lean inverted triangle build, noticeably broader shoulders than hips, athletic upper body, narrow straight lower body';
  if (bmiValue < 28) return 'inverted triangle build, broader shoulders and chest than hips, strong angular upper body, narrower lower body';
  return 'full inverted triangle build, wide strong shoulders, fuller upper body and chest, relatively narrower hips and thighs';
}

function severityForRectangleWomen(bmiValue: number): string {
  if (bmiValue < 22) return 'slim straight female build, minimal curves, shoulders and hips similar width, lean and streamlined throughout';
  if (bmiValue < 27) return 'straight female build, balanced proportions, minimal waist definition, similar shoulder and hip width';
  return 'fuller straight female build, heavier frame distributed evenly, wider proportions without prominent curves';
}

function severityForPear(bmiValue: number): string {
  if (bmiValue < 22) return 'slim pear build, narrower shoulders, slightly fuller hips and thighs, slim upper body';
  if (bmiValue < 28) return 'pear build, noticeably narrower shoulders than hips, fuller thighs and hips, clothing fits differently upper vs lower body';
  return 'full pear build, significantly fuller hips thighs and bottom, much narrower upper body and shoulders by comparison, very pronounced lower body and hips';
}

function severityForApple(bmiValue: number): string {
  if (bmiValue < 24) return 'slight apple build, slightly fuller midsection, slimmer legs and hips, mild roundness through the waist';
  if (bmiValue < 32) return 'apple build, fuller rounded midsection, slimmer legs and hips, weight carried through the torso and waist';
  return 'full apple build, very full rounded torso and midsection, heavier through the waist and chest, slimmer legs relative to upper body, weight concentrated in the middle';
}

function severityForSlimWomen(bmiValue: number): string {
  if (bmiValue < 19) return 'very lean slight female build, narrow frame throughout, minimal curves, very slim proportions';
  if (bmiValue < 23) return 'slim female build, light and lean frame, gently curved proportions, light through the body';
  return 'slim self-identified female build, light to medium frame with gentle presence';
}

// ── Public export ─────────────────────────────────────────────────────────────

export function buildBodyTypeSeverity(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  bodyType: string | null | undefined,
  gender?: string | null,
): SeverityResult {
  const isWoman = gender === 'woman';
  const negativePrompt = bodyType
    ? ((isWoman ? NEGATIVE_PROMPTS_WOMEN : NEGATIVE_PROMPTS_MEN)[bodyType] ?? '')
    : '';

  // No body type set — neutral default
  if (!bodyType) {
    return FALLBACK_DEFAULT;
  }

  // Missing measurements — fall back to static description
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    const fallbackMap = isWoman ? FALLBACK_DESCRIPTIONS_WOMEN : FALLBACK_DESCRIPTIONS_MEN;
    return {
      description: fallbackMap[bodyType] ?? FALLBACK_DEFAULT.description,
      negativePrompt,
    };
  }

  const bmiValue = bmi(heightCm, weightKg);
  let description: string;

  if (isWoman) {
    switch (bodyType) {
      case 'hourglass':
        description = severityForHourglass(bmiValue);
        break;
      case 'inverted_triangle':
        description = severityForInvertedTriangle(bmiValue);
        break;
      case 'rectangle':
        description = severityForRectangleWomen(bmiValue);
        break;
      case 'pear':
        description = severityForPear(bmiValue);
        break;
      case 'apple':
        description = severityForApple(bmiValue);
        break;
      case 'slim':
        description = severityForSlimWomen(bmiValue);
        break;
      default:
        description = FALLBACK_DESCRIPTIONS_WOMEN[bodyType] ?? FALLBACK_DEFAULT.description;
    }
  } else {
    switch (bodyType) {
      case 'oval':
        description = severityForOval(bmiValue);
        break;
      case 'athletic':
        description = severityForAthletic(bmiValue);
        break;
      case 'rectangle':
        description = severityForRectangleMen(bmiValue);
        break;
      case 'slim':
        description = severityForSlimMen(bmiValue);
        break;
      default:
        description = FALLBACK_DESCRIPTIONS_MEN[bodyType] ?? FALLBACK_DEFAULT.description;
    }
  }

  return { description, negativePrompt };
}
