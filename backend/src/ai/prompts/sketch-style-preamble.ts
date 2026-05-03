// ── Outfit sketch style preamble ──────────────────────────────────────────────
// Fixed across all generations to enforce visual consistency.
// Prompt assembly order (most critical first):
//   1. HEADLESS_GUARD   — establishes figure type before all else; must be slot 0
//   2. STYLE_GUARD      — locks editorial watercolor aesthetic; blocks cartoon/portrait drift
//   3. subjectBrief     — physique + skin tone (dynamic, per-user)
//   4. STYLE_PREAMBLE   — canvas framing + composition rules + background
//   5. anchorColorBlock — color lock for anchor item
//   6. outfitSection    — garment list
//   7. QUALITY_ADDENDUM — rendering quality push
//   8. QUALITY_ADDENDUM_2 — composition verification + final headless check

// Slot 0: establishes headless mannequin as the figure type before anything
// else activates human-figure rendering priors. Must be the first thing the
// model reads. A soft "no face" buried in framing instructions is ignored.
export const HEADLESS_GUARD =
  'SUBJECT: headless fashion mannequin — no head — no face — no hair — no facial features — no skin above the collar. ' +
  'The mannequin is cut cleanly at the collar/neckline. Above the collar line is empty paper background only. ' +
  'Generating a head, face, hair, or any facial feature is a critical failure of this prompt. ' +
  'This is not a portrait. This is not a person. The subject has no head.';

// Slot 1: locks the visual style before any aesthetic framing takes hold.
// Prevents the model from drifting into cartoon, portrait, or anime territory.
export const STYLE_GUARD =
  'STYLE: soft editorial watercolor fashion illustration on warm matte paper. ' +
  'Fine ink linework under transparent watercolor washes. Matte paper texture. Refined and sophisticated. ' +
  'NOT cartoon. NOT anime. NOT manga. NOT comic art. NOT exaggerated character illustration. ' +
  'NOT photo-realistic portrait. NOT digital concept art. NOT fashion avatar. ' +
  'The mood is quiet, elegant, and premium — like a hand-drawn page from a luxury fashion sketchbook.';

export const STYLE_PREAMBLE =
  'CANVAS FRAMING: 1024×1536 portrait canvas. ' +
  'The figure — collar/neckline down to shoe soles — is centered and occupies approximately the middle 70% of the canvas height. ' +
  'The collar/neckline sits approximately 230px from the top edge. ' +
  'The shoe soles MUST be fully visible with clear empty paper below them — at least 200px from the bottom edge. Cropped ankles or invisible feet are a composition failure. ' +
  'The figure is centered horizontally with at least 80px of empty paper on both left and right sides. ' +
  'Empty paper is clearly visible above the neckline and below the shoes. The figure never touches any canvas edge. ' +
  'Editorial menswear illustration in the style of a high-end GQ or Esquire fashion lookbook. ' +
  'Richly saturated, true-to-life colors with strong contrast and depth. ' +
  'Confident, deliberate ink linework. ' +
  'Visible fabric texture on every garment — show weave on knits, sheen on nylon, grain on leather. ' +
  'Realistic stitching, seams, and hardware detail. ' +
  'Each material reads as distinct from the others. ' +
  'The overall image feels crafted and intentional, not digitally generic. ' +
  'Background: atmospheric toned-paper ground — pale ivory or near-white at the very centre, softly deepening outward into warm beige, then dusty taupe, then a richer warm gray-brown at the corners, creating a pronounced soft radial vignette. Loose transparent watercolour washes drift and bloom across the surface with visible paper grain, subtle pooling, uneven pigment saturation, soft brush residue at the edges, and faint cloud-like tonal variation throughout. The overall effect resembles naturally aged, warmly lit watercolour paper with ambient shadow gathering at the periphery — never a flat, uniform, or digitally clean fill. ' +
  'Garments drape and fold naturally with realistic tailoring weight, precise collar construction, pocket placement, and button details clearly visible. ' +
  'Accessories are rendered as a clean flat-lay beside the figure — each item fully within the canvas, clearly isolated, identifiable, and true to its described color and material.';

// ── Outfit quality addendum ───────────────────────────────────────────────────
// Appended after the outfit bullet list to push rendering quality and fidelity.

export const QUALITY_ADDENDUM =
  'Push the rendering toward a high-end fashion concept sketch — the kind printed in a luxury menswear style board or editorial lookbook. ' +
  'Make the outfit feel more stylish, directional, and modern, with sharper taste, stronger styling, and more confident silhouette choices while staying completely true to the provided garments. ' +
  'Increase color fidelity: the anchor piece and every described clothing item must match the real garment color as accurately as possible, prioritizing the exact hue, depth, temperature, and saturation of the source item rather than drifting toward generic beige, tan, or neutralized approximations. ' +
  'Do not reinterpret the anchor item\'s color; preserve it faithfully. ' +
  'Increase richness and vibrancy while keeping the palette refined and believable, so the image feels alive and confident. ' +
  'Add more garment detail and material realism: show seam lines, ribbing, stitch lines, plackets, pocket construction, zipper hardware, fabric grain, creases, drape, cuff structure, collar shape, sole detail, and small accessory details with precision. ' +
  'Use layered ink and tonal depth, nuanced shadowing, and tactile surface detail so the garments feel luxurious and dimensional. ' +
  'Avoid color drift, generic neutralization, flat fills, or loss of garment-specific detail.';

export const QUALITY_ADDENDUM_2 =
  'HEADLESS VERIFICATION (check first): Does the figure have a head, face, hair, or any facial feature? If yes, that is a critical failure — the subject must be a headless mannequin cut at the collar/neckline. Above the neckline must be empty paper only. ' +
  'Increase the level of garment and accessory detail. ' +
  'Show more construction and material information: seam placement, topstitching, rib knit texture, zipper teeth and puller, pocket welts, plackets, collar structure, cuff shape, waistband finish, belt hardware, shoe panels, laces, sole edges, watch case detail, and subtle fabric grain. ' +
  'Make the colors richer and more vibrant while staying refined and believable, with stronger tonal contrast and clearer color separation between garments so the outfit feels fashion-forward, polished, and visually alive. ' +
  'Preserve accurate color fidelity to the source garments, especially the anchor piece, matching the true hue, saturation, undertone, and value rather than drifting toward generic tan or beige. ' +
  'COMPOSITION VERIFICATION (check before finalizing): Is the collar/neckline visible with empty paper above it? Are both shoe soles fully rendered and clearly visible with empty paper below them? Is the figure centered horizontally with empty paper on both sides? ' +
  'CRITICAL FRAMING CHECK — if shoe soles are not clearly visible with empty canvas below them, the figure is too large or positioned too low: scale the figure down and re-center vertically. Invisible feet or cropped ankles are a hard composition failure, not a stylistic choice. ' +
  'The correct result looks like a zoomed-out editorial lookbook photo: complete outfit floating in generous whitespace, not a cropped close-up filling the frame edge to edge.';
