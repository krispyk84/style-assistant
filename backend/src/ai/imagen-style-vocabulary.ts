/**
 * Vesture style vocabulary for the Imagen image-generation provider.
 *
 * Imagen 4 defaults to clean, polished digital illustration when given generic
 * style terms. These constants fight that default with specific texture cues that
 * push output toward the Vesture editorial watercolor-sketch aesthetic (the same
 * look the fal.ai Flux LoRA produces natively via trigger-word fine-tuning).
 *
 * Each constant targets a distinct visual layer:
 *   STYLE_LINES    — ink contour quality (hand-drawn vs perfect digital)
 *   STYLE_WASH     — watercolor fill behaviour (loose vs airbrushed)
 *   STYLE_BG       — background texture (parchment with watercolor clouds vs flat white)
 *   STYLE_PALETTE  — color register (muted/aged vs vivid/saturated)
 *   STYLE_FRAME    — editorial register (luxury atelier sketch vs ecommerce render)
 */

export const STYLE_LINES =
  'precise ink contour lines with slight hand-drawn roughness, ' +
  'thin-to-thick brush-pen line variation, visible ink stroke texture';

export const STYLE_WASH =
  'loose transparent watercolor wash fills, ' +
  'visible watercolor bleed at fabric edges, ' +
  'dry-brush texture on fabric surfaces and shadow folds, ' +
  'soft wet-on-wet colour bleeding in shadow areas, ' +
  'matte paper finish throughout, ' +
  'pigment absorbed into paper grain, no gloss no sheen on any surface, ' +
  'soft diffuse ambient light only, no specular highlights, no reflections, no rim lighting, ' +
  'all fabric and accessories look absorbent and cloth-like, not synthetic not shiny';

export const STYLE_BG =
  'warm aged parchment paper background, ' +
  'loose translucent watercolor wash pools and soft clouds behind figure, ' +
  'warm ivory and pale ochre paper tone, subtle paper grain texture';

export const STYLE_PALETTE =
  'desaturated muted earthy colour palette, ' +
  'aged toned-down fabric pigments, restrained tonal values, not vivid not saturated';

export const STYLE_FRAME =
  'luxury menswear editorial fashion sketch, ' +
  'fashion atelier illustration, refined lookbook illustration';

/**
 * Negative prompt — blocks Imagen 4's default clean-digital and photorealistic
 * tendencies. Sent for both auth modes (negativePrompt lives in the instances
 * object which AI Studio supports; only parameters fields like addWatermark are
 * restricted to Vertex AI).
 */
export const BASE_NEGATIVE_PROMPT =
  'photorealistic, photograph, 3D render, CGI, hyperrealistic, realistic, ' +
  'product photography, studio photo, ' +
  'digital painting, digital concept art, airbrushed shading, smooth gradient shading, ' +
  'glossy, shiny, plastic sheen, lacquer finish, varnish, satin finish, ' +
  'specular highlights, reflective fabric, metallic sheen, rim lighting, ' +
  'studio product lighting, commercial fashion photography lighting, ray-traced reflections, ' +
  'synthetic fabric texture, polished surface, high gloss, wet look, ' +
  'clean crisp digital lines, perfectly uniform background, ' +
  'flat white background, smooth white background, ' +
  'oil painting, anime, cartoon, flat vector illustration, ' +
  'human head, face, facial features, ' +
  'flat lay, flatlay, clothing hanger, product display, clothes folded, styled flat, ' +
  'cropped at knees, cropped at ankles, cut-off feet, shoes cut off, partial legs, incomplete figure, torso only';

/**
 * Style prefix for outfit sketches.
 * All five style layers combined, plus figure framing.
 * The Flux LoRA achieves this aesthetic via trigger-word fine-tuning; Imagen
 * requires explicit layered cues to reach the same visual register.
 */
export const OUTFIT_STYLE_PREFIX =
  `${STYLE_LINES}, ${STYLE_WASH}, ${STYLE_BG}, ${STYLE_PALETTE}, ${STYLE_FRAME}, ` +
  'headless tailor\'s dress form, no head, small round neck finial only, ' +
  'full-length figure from neck finial to shoes';

/**
 * Style prefix for closet single-garment sketches.
 * Same ink/wash/background vocabulary, framed for a single centered item.
 */
export const CLOSET_STYLE_PREFIX =
  `${STYLE_LINES}, ${STYLE_WASH}, ${STYLE_BG}, ${STYLE_PALETTE}, ` +
  'single garment fashion sketch, faithful construction rendering, ' +
  'centered single item, no gradient, no vignette';
