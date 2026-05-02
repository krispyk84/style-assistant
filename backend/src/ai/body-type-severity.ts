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
 *
 * weightDistribution (women only) is combined with the base body type description
 * to produce a composite figure description. The two signals are additive and
 * both must appear in the output.
 */

type SeverityResult = {
  description: string;
  negativePrompt: string;
};

// ── Height rendering cues ─────────────────────────────────────────────────────

function heightRenderingCue(heightCm: number): string {
  if (heightCm < 158)
    return 'very short and petite stature, compact proportions throughout, legs noticeably shorter than average';
  if (heightCm < 168)
    return 'slightly shorter than average height, somewhat compact proportions';
  if (heightCm < 180)
    return ''; // average — no special cue, avoid over-specifying
  if (heightCm < 190)
    return 'taller than average stature, slightly elongated proportions, longer legs';
  if (heightCm < 198)
    return 'tall stature, clearly elongated proportions, noticeably longer legs and torso';
  return 'very tall stature — significantly taller than average, notably elongated proportions, much longer legs and torso, the figure occupies more vertical height in the frame than a typical fashion figure';
}

// ── Skin tone rendering ───────────────────────────────────────────────────────

type SkinToneSpec = { description: string; negative: string };

const SKIN_TONE_RENDERING: Record<string, SkinToneSpec> = {
  fair:   {
    description: 'very pale fair skin, almost porcelain, cool or neutral undertone, very light complexion with no tan',
    negative:    'tan skin, olive skin, medium skin, dark skin, warm golden complexion, brown skin, yellow undertone',
  },
  light:  {
    description: 'pale light skin, cool-to-neutral undertone, visibly lighter than medium complexion, no tan',
    negative:    'tan skin, olive skin, medium skin, dark skin, golden complexion, brown skin, warm undertone, dark hands',
  },
  medium: {
    description: 'medium warm complexion, lightly tanned or golden-beige skin tone',
    negative:    'very pale skin, porcelain skin, fair skin, dark brown skin, olive skin, deep complexion',
  },
  olive:  {
    description: 'warm olive complexion, yellow-green undertone, Mediterranean or South Asian skin tone',
    negative:    'pale pink skin, fair skin, dark brown skin, porcelain skin, rosy undertone',
  },
  deep:   {
    description: 'deep warm brown complexion, rich brown skin tone',
    negative:    'pale skin, fair skin, light skin, olive skin, pink undertone, medium complexion',
  },
  black:  {
    description: 'deep dark complexion, very dark brown to black skin tone',
    negative:    'pale skin, light skin, medium skin, olive skin, brown complexion, fair complexion',
  },
};

// ── Fit tendency visual cues ──────────────────────────────────────────────────

const FIT_TENDENCY_CUES: Record<string, string> = {
  fits_well:               '',
  tight_chest_loose_below: 'clothing fits tightly across the chest and shoulders — show visible fabric tension and pulling across the chest and upper body, looser and more relaxed drape through the torso and lower body',
  loose_chest_tight_below: 'clothing sits more loosely through the chest and upper body; fits more closely and shows visible tension through the waist, hips, and lower body',
};

// ── Negative instruction builder ─────────────────────────────────────────────

function buildNegativeInstruction(
  skinTone: string | null | undefined,
  bodyType: string | null | undefined,
  physique: string,
): string {
  const lines: string[] = [];

  // Physique negative
  const isFullFigure =
    physique.includes('overweight') ||
    physique.includes('belly') ||
    physique.includes('obese') ||
    physique.includes('heavy') ||
    physique.includes('large');
  const isMuscular = physique.includes('muscular') || physique.includes('athletic');
  const isSlim = bodyType === 'slim' || physique.includes('slim lean');

  if (isFullFigure) {
    lines.push('Do not render a slim, lean, flat-stomached, or average fashion figure for this profile.');
    lines.push('Do not depict a narrow waist, flat belly, or thin build — the physique must show visible mass, fullness, and body weight.');
  } else if (isMuscular) {
    lines.push('Do not render a slim or average build — the physique must show visibly muscular and large proportions.');
  } else if (isSlim) {
    lines.push('Do not render a heavy, muscular, or bulky build — the physique should appear lean and light.');
  }

  // Skin tone negative
  if (skinTone === 'fair' || skinTone === 'light') {
    const toneName = skinTone === 'fair' ? 'very pale/fair (near-porcelain)' : 'pale/light';
    lines.push(`Do not render olive, medium, tan, dark, or brown skin — skin tone must be ${toneName}.`);
  } else if (skinTone === 'deep' || skinTone === 'black') {
    lines.push('Do not render light, pale, or fair skin — skin tone must be deep/dark brown.');
  } else if (skinTone === 'olive') {
    lines.push('Do not render pale/fair or dark skin — skin tone must be warm olive.');
  } else if (skinTone === 'medium') {
    lines.push('Do not render very pale or very dark skin — skin tone must be medium/tanned.');
  }

  lines.push('The physique must be clearly visible through garment drape and silhouette — do not default to a generic slim fashion mannequin figure.');

  return lines.join('\n');
}

// ── Subject rendering brief ───────────────────────────────────────────────────

export type SubjectRenderingBrief = {
  /** Full SUBJECT RENDERING BRIEF block — injected into the sketch prompt as a locked section. */
  block: string;
  /** Negative terms formatted for inline "do not" embedding — already included in block. */
  negativePrompt: string;
};

/**
 * All profile-derived inputs that influence how the illustrated figure renders.
 * Computed once per outfit so every tier sketch sees the same body.
 */
export type SubjectRenderingInput = {
  heightCm?: number | null;
  weightKg?: number | null;
  bodyType?: string | null;
  gender?: string | null;
  weightDistribution?: string | null;
  fitTendency?: string | null;
  skinTone?: string | null;
};

/**
 * Builds a SUBJECT RENDERING BRIEF from all available profile signals.
 * This is the single source of truth for how the illustrated figure should look.
 * It is computed once per outfit and reused identically across all tiers.
 *
 * Combines: physique (BMI + body type), height, skin tone, fit tendency.
 * The output is a locked prompt block — not a soft suggestion.
 */
export function buildSubjectRenderingBrief(input: SubjectRenderingInput): SubjectRenderingBrief {
  const severity = buildBodyTypeSeverity(
    input.heightCm,
    input.weightKg,
    input.bodyType,
    input.gender,
    input.weightDistribution,
  );

  const attributeLines: string[] = [];

  // Physique
  attributeLines.push(`PHYSIQUE: ${severity.description}`);

  // Height
  if (input.heightCm && input.heightCm > 0) {
    const cue = heightRenderingCue(input.heightCm);
    if (cue) {
      attributeLines.push(`HEIGHT: ${cue}`);
    }
  }

  // Skin tone
  const skinSpec = input.skinTone ? SKIN_TONE_RENDERING[input.skinTone] : null;
  if (skinSpec) {
    attributeLines.push(`SKIN TONE: ${skinSpec.description}`);
  }

  // Fit tendency
  const fitCue = input.fitTendency ? (FIT_TENDENCY_CUES[input.fitTendency] ?? '') : '';
  if (fitCue) {
    attributeLines.push(`FIT CUES: ${fitCue}`);
  }

  const negativeInstruction = buildNegativeInstruction(input.skinTone, input.bodyType, severity.description);
  const negativePrompt = [
    severity.negativePrompt,
    skinSpec?.negative ?? '',
  ].filter(Boolean).join(', ');

  const block = [
    `SUBJECT RENDERING BRIEF (locked constraints — apply before styling, do not override with fashion defaults):`,
    `These physical attributes are fixed. They must be reflected in how the figure is illustrated:`,
    ``,
    attributeLines.join('\n'),
    ``,
    negativeInstruction,
  ].join('\n');

  return { block, negativePrompt };
}

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
  hourglass: 'shapeless build, no waist definition, straight rectangular silhouette, equal shoulder hip and waist width, boxy frame, no curves, slim fashion model, slender proportions, model-thin figure',
  inverted_triangle: 'narrow shoulders, equal shoulder and hip width, pear shape, wide hips, slim upper body, slim fashion model, slender proportions, model-thin figure',
  rectangle: 'hourglass curves, defined waist, wide hips, pear shape, full curves, slim fashion model, slender proportions, model-thin figure',
  pear: 'equal hip and shoulder width, straight silhouette, slim hips, narrow lower body, inverted triangle build, athletic shoulders, slim fashion model, slender proportions, model-thin figure',
  apple: 'defined waist, slim waist, hourglass figure, pear shape, slim midsection, flat stomach, narrow torso, slim build, thin waist, athletic figure, fashion model proportions, lean torso, flat belly, straight silhouette, slim fashion model, slender proportions, model-thin',
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
  if (bmiValue < 26) return 'classic hourglass build, clearly defined narrow waist, equal rounded shoulder and hip width, balanced curves throughout';
  if (bmiValue < 31) return 'full hourglass build, generous rounded curves at chest and hips, clearly defined narrower waist between fuller chest and rounded hips, curvaceous throughout';
  return 'large full-figured hourglass build, very generous rounded curves throughout, prominent rounded chest and hips, defined waist still visible between much fuller upper and lower body, full-figured and curvaceous';
}

function severityForInvertedTriangle(bmiValue: number): string {
  if (bmiValue < 22) return 'lean inverted triangle build, noticeably broader shoulders than hips, athletic upper body, narrow straight lower body';
  if (bmiValue < 28) return 'inverted triangle build, noticeably broader shoulders and fuller chest than hips, strong upper body, comparatively narrow lower body';
  if (bmiValue < 33) return 'full inverted triangle build, wide broad shoulders, heavy fuller upper body and chest, relatively narrow hips and thighs in contrast';
  return 'large inverted triangle build, very wide broad shoulders, heavy and full upper body, much narrower lower body and hips, top-heavy proportions with substantial upper body mass';
}

function severityForRectangleWomen(bmiValue: number): string {
  if (bmiValue < 22) return 'slim straight build, minimal curves, shoulders and hips similar width, lean and streamlined throughout';
  if (bmiValue < 27) return 'straight build, balanced proportions, minimal waist definition, similar shoulder and hip width';
  if (bmiValue < 33) return 'fuller straight build, heavier frame distributed evenly throughout, wider proportions, minimal curves, clothing fitting closely at all points equally';
  return 'large heavy straight build, substantially wider proportions distributed evenly, heavy frame throughout without curve definition, full-figured with equal width at shoulders waist and hips';
}

function severityForPear(bmiValue: number): string {
  if (bmiValue < 22) return 'slim pear build, narrower shoulders, slightly fuller hips and thighs, slim upper body';
  if (bmiValue < 26) return 'pear build, noticeably narrower shoulders than hips, fuller thighs and hips, clothing fits differently upper vs lower body';
  if (bmiValue < 32) return 'full pear build, significantly fuller and heavier hips thighs and bottom, much narrower upper body and shoulders by comparison, very pronounced lower body fullness';
  return 'large pear build, very heavy and full hips thighs and bottom, clothing stretched across the hips and thighs, markedly narrow upper body and slim shoulders in contrast, substantial lower body mass';
}

function severityForApple(bmiValue: number): string {
  if (bmiValue < 24) return 'slight apple build, slightly fuller midsection, slimmer legs and hips, mild roundness through the waist';
  if (bmiValue < 28) return 'apple build, rounded fuller midsection, belly rounder than hips and legs, weight carried through the torso and waist, slimmer lower body';
  if (bmiValue < 32) return 'full apple build, noticeably heavy rounded midsection, belly clearly fuller and rounder than hips, weight concentrated in the torso, comparatively slimmer legs';
  return 'large plus-size apple build, very heavy protruding belly, midsection substantially heavier than legs and hips, thick heavy torso, rounded belly protruding past the hips, comparatively slimmer legs, weight concentrated in upper body and midsection';
}

function severityForSlimWomen(bmiValue: number): string {
  if (bmiValue < 19) return 'very lean slight build, narrow frame throughout, minimal curves, very slim proportions';
  if (bmiValue < 23) return 'slim build, light and lean frame, gently curved proportions, light through the body';
  return 'slim self-identified build, light to medium frame with gentle presence';
}

// ── Weight distribution combination ──────────────────────────────────────────

/**
 * Combines base body type severity with weight distribution signal.
 * The two descriptors are additive — both must appear in the final prompt.
 * BMI-calibrates the strength of the weight distribution addition.
 */
function applyWeightDistribution(
  bodyType: string,
  weightDistribution: string,
  bmiValue: number,
  baseDescription: string,
  baseNegative: string,
): SeverityResult {
  if (weightDistribution === 'even') {
    return { description: baseDescription, negativePrompt: baseNegative };
  }

  if (weightDistribution === 'midsection') {
    let addition: string;
    if (bmiValue < 24) {
      // apple amplifies even at low BMI
      addition = bodyType === 'apple'
        ? 'noticeable rounded belly, mild-to-moderate fullness at the waist, clothes fitting tighter at the midsection'
        : 'slight rounded belly, mild fullness at the waist, clothes fitting slightly differently at the midsection';
    } else if (bmiValue < 30) {
      // apple amplifies at mid BMI
      addition = bodyType === 'apple'
        ? 'very pronounced rounded belly, weight clearly concentrated in the waist and midsection, clothing fitting much tighter at the waist than at the hips and chest'
        : 'rounded fuller belly, weight visible through the waist and midsection, clothing fitting differently at the waist than at the hips and chest';
    } else {
      // apple at high BMI: belly is the dominant feature — use maximally explicit language
      addition = bodyType === 'apple'
        ? 'very large heavy rounded belly dominating the midsection, belly protruding prominently past the hips, clothing straining across the belly and waist, waist and midsection much wider than legs'
        : 'prominent rounded belly extending past the hipline, belly clearly visible through the midsection, clothing pulling tight across the waist';
    }

    // pear / inverted_triangle creates contrast — upper body is slim so fullness is isolated
    if (bodyType === 'pear' || bodyType === 'inverted_triangle') {
      addition += ', fullness concentrated in the midsection only, slimmer hips than typical for shape';
    }

    const negativeAddition = 'flat stomach, slim waist, defined waist, slim midsection, weight in lower body, flat belly, thin waist';
    return {
      description: `${baseDescription}, ${addition}`,
      negativePrompt: baseNegative ? `${baseNegative}, ${negativeAddition}` : negativeAddition,
    };
  }

  if (weightDistribution === 'hips') {
    let addition: string;
    if (bmiValue < 24) {
      addition = 'noticeably fuller rounder hips and thighs, weight concentrated in the lower body, narrower upper body relative to hips';
    } else if (bmiValue < 30) {
      addition = 'very full rounded hips and thighs, weight visibly concentrated in the lower body, clothing pulling close through thighs and hips, narrower upper body in contrast';
    } else {
      addition = 'very full heavy hips and thighs, weight heavily concentrated in the lower body, clothing stretched across hips and thighs, significantly narrower shoulders and chest in contrast';
    }

    // pear amplifies — lower body fullness is already the defining trait
    if (bodyType === 'pear') {
      addition = addition.replace('very full rounded', 'extremely full pronounced').replace('noticeably fuller rounder', 'very full rounder');
    }

    // hourglass maintains waist definition
    if (bodyType === 'hourglass') {
      addition += ', defined waist still clearly visible between fuller hips and chest';
    }

    // rectangle / inverted_triangle gains lower body that contrasts the straighter upper body
    if (bodyType === 'rectangle' || bodyType === 'inverted_triangle') {
      addition += ', lower body fullness contrasts the straighter narrower upper body';
    }

    const negativeAddition = 'top-heavy, fuller chest, weight in upper body, slim hips, narrow lower body, slim lower body, thin thighs, fashion model hips';
    return {
      description: `${baseDescription}, ${addition}`,
      negativePrompt: baseNegative ? `${baseNegative}, ${negativeAddition}` : negativeAddition,
    };
  }

  if (weightDistribution === 'chest') {
    let addition: string;
    if (bmiValue < 24) {
      addition = 'noticeably fuller chest and bust, clothing fitting more closely across the upper chest, defined contrast between upper and lower body';
    } else if (bmiValue < 30) {
      addition = 'fuller chest and bust, volume concentrated above the waist, clothing fitting tightly across the upper chest, defined contrast between chest and lower body';
    } else {
      addition = 'very full heavy chest and bust, substantial volume through the upper body, clothing stretched across the chest, narrower lower body in contrast';
    }

    // inverted_triangle amplifies — upper body dominance is already the defining trait
    if (bodyType === 'inverted_triangle') {
      addition = addition.replace('fuller chest and bust', 'very full and prominent chest and bust').replace('noticeably fuller', 'very full and prominent');
    }

    // hourglass maintains waist definition
    if (bodyType === 'hourglass') {
      addition += ', defined waist maintained, volume concentrated above the waist';
    }

    // pear / apple creates a counter-balance — fullness up top offsets lower body
    if (bodyType === 'pear' || bodyType === 'apple') {
      addition += ', fuller upper body creates visual balance against the lower body';
    }

    const negativeAddition = 'flat chest, narrow bust, weight in lower body, wider hips than chest, slim upper body, fashion model bust, small chest';
    return {
      description: `${baseDescription}, ${addition}`,
      negativePrompt: baseNegative ? `${baseNegative}, ${negativeAddition}` : negativeAddition,
    };
  }

  return { description: baseDescription, negativePrompt: baseNegative };
}

// ── Public export ─────────────────────────────────────────────────────────────

export function buildBodyTypeSeverity(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
  bodyType: string | null | undefined,
  gender?: string | null,
  weightDistribution?: string | null,
): SeverityResult {
  const isWoman = gender === 'woman';
  const negativePrompt = bodyType
    ? ((isWoman ? NEGATIVE_PROMPTS_WOMEN : NEGATIVE_PROMPTS_MEN)[bodyType] ?? '')
    : '';

  // No body type set — neutral default
  if (!bodyType) {
    return FALLBACK_DEFAULT;
  }

  // Missing measurements — fall back to static description (no weight distribution applied)
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

  const base: SeverityResult = { description, negativePrompt };

  // Apply weight distribution only for women with a known distribution
  if (isWoman && weightDistribution && weightDistribution !== 'even') {
    return applyWeightDistribution(bodyType, weightDistribution, bmiValue, description, negativePrompt);
  }

  return base;
}
