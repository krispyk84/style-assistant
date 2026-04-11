/**
 * Prompt construction for the Gemini style-conditioned image generation client.
 *
 * Builds the instruction text that accompanies the style reference images.
 * The prompt is split into two explicit concerns so Gemini keeps them separate:
 *   STYLE: defined entirely by the reference images — replicate, don't invent
 *   CONTENT: defined entirely by the outfit description text — draw these items
 */

/**
 * Style attributes to match — positive and negative.
 * Shared by both outfit and closet prompts so they stay in sync.
 *
 * The ANTI_GLOSS block is the critical addition: Google image models default
 * to smooth, polished, commercial renders. Every line here fights that default.
 */
const STYLE_MATCH = `\
Match these specific visual qualities from the reference images:
- SURFACE: matte paper — no gloss, no sheen, no plastic highlights, no lacquer finish anywhere
- PIGMENT: soft watercolor wash absorbed into textured paper grain — not flat digital colour fill
- FABRIC: all garments look like real cloth, matte and absorbent — not vinyl, not synthetic, not shiny
- BACKGROUND: warm parchment paper with loose translucent watercolor wash clouds; flat and matte
- LINES: fine ink contour lines with slight hand-drawn roughness; not clean crisp digital lines
- LIGHTING: soft diffuse ambient light only — no studio highlights, no specular reflections, no rim light
- FIGURE: headless dress form or mannequin — no face, no head
- PALETTE: muted, desaturated earthy tones — not vivid, not saturated
- FEEL: editorial luxury atelier sketch — restrained, painterly, hand-illustrated`;

const ANTI_GLOSS = `\
CRITICAL — do NOT produce any of the following:
- glossy or shiny fabric rendering
- plastic sheen or synthetic surface highlights
- specular reflections or studio product-render lighting
- polished lacquer or varnish finish on any surface
- commercial concept-art or CGI render look
- smooth digital gradients that look airbrushed
- 3D mockup or ecommerce product visualisation aesthetic
All surfaces — fabric, background, accessories — must look matte, painterly, and hand-illustrated on paper.`;

export function buildOutfitPrompt(outfitPrompt: string): string {
  return (
    'These are style reference images for a luxury menswear fashion illustration app.\n\n' +
    STYLE_MATCH + '\n\n' +
    ANTI_GLOSS + '\n\n' +
    'DO NOT copy any garments, outfits, or accessories from the reference images. ' +
    'The references control ONLY the visual illustration style and surface quality.\n\n' +
    'Draw this specific new outfit in that illustration style:\n' +
    outfitPrompt
  );
}

export function buildClosetPrompt(itemPrompt: string): string {
  return (
    'These are style reference images for a luxury menswear fashion illustration app.\n\n' +
    STYLE_MATCH + '\n\n' +
    ANTI_GLOSS + '\n\n' +
    'DO NOT copy any garments from the reference images. ' +
    'The references control ONLY the illustration style and surface quality.\n\n' +
    'Draw this specific single garment in that illustration style:\n' +
    itemPrompt
  );
}
