import { env } from '../config/env.js';
import type { GenerateImageInput } from './fal-types.js';

const NEGATIVE_PROMPT =
  // ── Figure / composition guards ───────────────────────────────────────────
  'two figures, multiple figures, two mannequins, multiple mannequins, side by side, outfit comparison, split view, duplicate figure, ' +
  'face, human face, head, human head, portrait, facial features, eyes, nose, mouth, ears, hair, neck, realistic face, anime face, ' +
  'person with head, realistic human, bald head, skull, forehead, chin, cheekbones, ' +
  'neck above collar line, exposed neck skin, jawline, chin above collar, visible neck, bare neck, ' +
  // ── Realism / render guards ────────────────────────────────────────────────
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, product photography, studio photo, ' +
  'digital painting, oil painting, anime, cartoon, ' +
  // ── Composition guards ─────────────────────────────────────────────────────
  'flat lay, flatlay, lookbook, clothing hanger, product display, clothes folded, styled flat, ' +
  'accessories on ground, accessories beside feet, items on floor beside figure, flat-lay accessories, ' +
  'second pair of shoes, extra footwear beside figure, shoes beside, loafers beside, boots beside, ' +
  'cropped at knees, cropped at ankles, cut-off feet, shoes cut off, partial legs, incomplete figure, torso only, ' +
  // ── Anti-polish / anti-digital-clean — these fight the LoRA's default clean mode ──
  'glossy, shiny, plastic sheen, lacquer finish, varnish, satin finish, ' +
  'synthetic fabric highlight, specular highlights, specular reflections, reflective fabric, ' +
  'studio product lighting, rim lighting, ray-traced reflections, commercial product render, ' +
  'smooth digital gradient, airbrushed shading, smooth gradient shading, ' +
  'perfectly uniform color fill, flat uniform fill areas, ' +
  'crisp vector-like lines, hard clean digital contours, perfectly uniform line weight, ' +
  'clean commercial concept art, polished digital illustration, hard-edged shadows, ' +
  'high-contrast render, ultra-sharp edges, clean crisp digital lines, ' +
  '3D mockup aesthetic, ecommerce product visualisation, flat perfect digital render';

export function buildFalRequestParams(input: GenerateImageInput) {
  const isCloset = input.loraType === 'closet';
  const loraUrl = isCloset ? env.CLOSET_LORA_URL : env.OUTFIT_LORA_URL;
  const triggerWord = isCloset ? 'VESTURE_ITEM' : 'VESTURE_OUTFIT';
  // Accessories (sunglasses, bags, watches, etc.) must NOT use the LoRA trigger word.
  // VESTURE_ITEM fires the mannequin-on-dress-form prior trained into the LoRA, which
  // overrides any "product only / no figure" instruction in the prompt.
  const fullPrompt = input.itemType === 'accessory' ? input.prompt : `${triggerWord}, ${input.prompt}`;

  // Append anchor-category drift suppression to the base negative prompt so the
  // model cannot substitute a tier-appropriate archetype (e.g. blazer for bomber).
  const negativePrompt = input.additionalNegativePrompt
    ? `${NEGATIVE_PROMPT}, ${input.additionalNegativePrompt}`
    : NEGATIVE_PROMPT;

  // guidance_scale 5.0 for outfits (down from 6.0): reduces the model's tendency
  // to over-sharpen and over-clean the output while still following the prompt closely
  // enough for anchor fidelity. Anchor drift is suppressed via the antiDrift
  // negative-prompt terms (from OpenAI vision), not by guidance strength.
  // Closet stays at 3.5 — single-garment fidelity needs less strict adherence.
  const guidanceScale = isCloset ? 3.5 : 5.0;
  const loraScale = 0.9;

  return { fullPrompt, negativePrompt, loraUrl, guidanceScale, loraScale };
}
