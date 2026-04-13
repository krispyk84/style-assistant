# Outfit / Sketch Inconsistency Log

## How to use this file
Each entry documents a observed inconsistency between a generated outfit 
recommendation and its sketch. Entries are added manually. Do not edit 
the schema — add new entries only.

## Schema
Each entry follows this format:

### [ID] — [short title]
- **Date observed:** 
- **Feature area:** (outfit generation / sketch generation / closet matching)
- **Trigger conditions:** (what request type, style, tier, or input caused it)
- **Expected behavior:** (what should have appeared)
- **Actual behavior:** (what actually appeared)
- **Frequency:** (once / occasional / consistent)
- **Example request ID or screenshot ref:** 
- **Notes:** (any hypothesis about root cause)

---

## Open Inconsistencies

### INC-006 — Not yet formally documented
- **Date observed:** Unknown
- **Feature area:** sketch generation
- **Trigger conditions:** Not yet recorded
- **Expected behavior:** Not yet recorded
- **Actual behavior:** Not yet recorded
- **Frequency:** Unknown
- **Example request ID or screenshot ref:** None
- **Notes:** This entry reserves the INC-006 number. Details and resolution to be added when the inconsistency is formally reproduced and documented.

---

## Resolved Inconsistencies

### INC-013 — Headless figure renders with oval/egg-shaped head (mannequin prior)
- **Date observed:** 2026-04-12
- **Feature area:** sketch generation
- **Trigger conditions:** Any sketch prompt that included the words "mannequin" or "dress form" in HEADLESS_OPENING.
- **Expected behavior:** The figure ends at the collar — no head, oval, sphere, or stump above the collar line.
- **Actual behavior:** The model rendered an oval or egg-shaped featureless form above the collar — the store-display mannequin head shape. The word "mannequin" activates a store-display mannequin prior in diffusion models which includes a distinctive oval plastic head.
- **Frequency:** Intermittent but systematic — triggered by the "mannequin" token in the opening slot.
- **Example request ID or screenshot ref:** Observed across multiple sessions.
- **Notes:** The CLIP token "mannequin" carries a visual prior of an oval-headed store mannequin, not a headless clothed figure. Period-separated sentences in HEADLESS_OPENING do not prevent the head-shape prior from activating because the prior is baked into the token embedding, not into the sentence boundary.
- **Resolution:** Fixed 2026-04-12. Replaced "mannequin" and "dress form" in HEADLESS_OPENING and HEADLESS_CLOSING with neutral "clothed figure" language. Added explicit anti-oval language: "The collar ends in open air — no oval, no egg shape, no sphere, no stump above the collar." Updated HEADLESS_CLOSING to reinforce: "The collar ends in empty air."

### INC-012 — Anchor color drifts to tier default; micro-check/pattern rendered as solid fabric
- **Date observed:** 2026-04-12
- **Feature area:** sketch generation
- **Trigger conditions:** Anchor with a named color that differs from the tier's archetypal color palette. Anchor with a surface pattern (micro-check, herringbone, plaid, stripe).
- **Expected behavior:** The anchor renders in its specified color. Surface patterns are visible on the fabric surface.
- **Actual behavior:** The anchor color shifts toward the tier-default palette (e.g. navy → charcoal under Business pressure). Micro-check and herringbone weaves are smoothed to solid fabric.
- **Frequency:** Occasional.
- **Notes:** The anchor description contains the color word as part of a garment name, but the model weights tier-default colors more heavily in later token slots. Pattern detail is similarly overridden by the style block's "muted desaturated editorial palette."
- **Resolution:** Fixed 2026-04-12. Added extractAnchorColor() (scans anchor description for ~40 color words) and patternHint() (detects micro-check, houndstooth, herringbone, plaid, stripe, check, tweed). Both are called inside anchorLock construction: color clause "Render the anchor in [color] — preserve this exact color, do not substitute with a tier-default hue" and pattern clause "Pattern: [description] — render this explicitly on the anchor fabric surface, do not simplify to solid."

### INC-011 — Quarter-zip collar rendered as turtleneck
- **Date observed:** 2026-04-12
- **Feature area:** sketch generation
- **Trigger conditions:** Dark Brown Quarter-Zip Sweater set as anchor. Smart Casual tier. Outfit includes a tan/camel blazer as outerwear. Sunglasses floating above the figure.
- **Expected behavior:** The sketch should show a dark brown quarter-zip sweater — the distinctive short zip at the collar and the characteristic funnel/mock neck should be visible beneath the blazer. The collar detail is the defining visual feature of a quarter-zip.
- **Actual behavior:** The sweater is rendered as a dark brown turtleneck — the collar is a full high roll, not a quarter-zip. The garment category is approximately correct (knit sweater, dark brown, worn under blazer) but the collar construction is completely wrong.
- **Frequency:** Once — but part of the consistent collar/garment detail erasure pattern.
- **Example request ID or screenshot ref:** Screenshot 7:51 PM — Smart Casual tier, Modern Smart-Casual Spring Layers. Anchor: Dark Brown Quarter-Zip Sweater, outerwear visible as camel blazer, pants: light stone tailored trousers.
- **Notes:** The image model has a weak representation of quarter-zip collar construction and defaults to turtleneck as the closest high-collar knit it knows confidently. The fix requires describing collar construction explicitly and literally.
- **Resolution:** Fixed 2026-04-12. Expanded categoryHint() quarter-zip branch in sketch.prompts.ts from "soft knitwear with short front zip and ribbed collar" to full collar construction: "soft knitwear with a short zip at the centre-front collar, approximately 10 cm zip length, funnel or mock neck with the zip pull visible at the top — NOT a turtleneck, NOT a full roll collar, NOT a crew neck, NOT a jacket, NOT a bomber jacket, NOT a chore coat, NOT outerwear."

### INC-004 (recurrence) — Sunglasses and hats render incorrectly on headless figure
- **Date observed:** 2026-04-12 (recurrence; original INC-004 fixed 2026-04-11)
- **Feature area:** sketch generation
- **Trigger conditions:** Outfit accessories include sunglasses, glasses, hats, or caps.
- **Expected behavior:** Accessories that cannot be worn on a headless figure should be excluded from the sketch prompt entirely — no floating eyewear, no hat hovering above an absent head.
- **Actual behavior:** Sunglasses classified as 'beside' appeared as "styled with the look" but still floated with no anchor point. Hats classified as 'above' generated a floating hat shape above the empty collar.
- **Frequency:** Consistent whenever sunglasses or hats are in accessories.
- **Notes:** A headless figure has no reference geometry for eyewear or headwear. Any rendering instruction for these items produces an unanchored floating object. The only correct behavior is to omit them from the sketch prompt.
- **Resolution:** Fixed 2026-04-12. Added OMIT_ACCESSORY_KEYWORDS list (hat, cap, beanie, fedora, beret, bucket hat, snapback, baseball cap, sunglasses, glasses). classifyAccessory() now returns 'omit' for these items, checked before worn/beside. Removed ABOVE_ACCESSORY_KEYWORDS and aboveAccessories/abovePart variables entirely — everything that was in 'above' is now in 'omit'. Items classified as 'omit' are silently excluded from all prompt slots.

### INC-005 — Headless mannequin constraint broken — human face rendered
- **Date observed:** 2026-04-11 (multiple instances)
- **Feature area:** sketch generation
- **Trigger conditions:** Observed across multiple outfit tiers and accounts. No specific anchor or tier required — occurs intermittently.
- **Expected behavior:** The sketch figure must always be a headless mannequin. No head, face, hair, or neck above the collar line should appear anywhere in the image.
- **Actual behavior:** Fully rendered human faces and hair appeared in generated sketches. In some instances a realistic face was rendered; in others a stylised or anime-adjacent face appeared above the collar.
- **Frequency:** Consistent enough across sessions to be considered a systematic failure, not a one-off.
- **Example request ID or screenshot ref:** Multiple screenshots across sessions. Pattern confirmed across different anchor types and tiers.
- **Notes:** The HEADLESS_OPENING already used object-framing language ("mannequin", "dress form") and period-separated statements to establish a prop prior. The HEADLESS_CLOSING was placed before the style block, meaning all style tokens fired after the closing reminder — diluting it. Additionally, neck-adjacent terms (jawline, chin above collar, exposed neck skin) were not in the negative prompt, leaving a gap for partial face/neck rendering to slip through.
- **Resolution:** Fixed 2026-04-12. Strengthened HEADLESS_CLOSING from "Remember: headless mannequin only, no head, no face, no hair" to "Headless mannequin only — absolutely no head, face, eyes, nose, mouth, ears, or hair anywhere in the image." Moved HEADLESS_CLOSING to the very last position in the prompt array (after the style block), so it fires as the final token reinforcement after all garment and style tokens. Added neck/jaw suppression terms to the fal-prompt-builder.ts NEGATIVE_PROMPT: "neck above collar line, exposed neck skin, jawline, chin above collar, visible neck, bare neck."

### INC-007 — Outerwear absent or flat-laid; distinctive garment features erased
- **Date observed:** 2026-04-11 (recurring)
- **Feature area:** sketch generation
- **Trigger conditions:** Outfits with outerwear in keyPieces. Garments with distinctive structural features (e.g. cargo pockets) described in the piece name with "with X" clauses.
- **Expected behavior:** All listed garments must appear worn on the single figure. Outerwear should be on the figure as the outermost layer, not floating, flat-laid, or on a second figure. Distinctive features like cargo pockets must be visible.
- **Actual behavior:** Two related failures: (1) Outerwear appeared as a flat-lay item beside the figure, or on a phantom second figure behind the main figure. (2) Piece names like "olive cargo pants with large visible side cargo pockets" were silently stripped to "olive cargo pants" by the prompt builder, removing the pocket feature from the prompt entirely.
- **Frequency:** Recurring — outerwear flat-lay observed in INC-004 and multiple subsequent sessions.
- **Example request ID or screenshot ref:** INC-004 screenshots. Cargo pants feature stripping observed in session around 2026-04-12.
- **Notes:** Two root causes: (1) No explicit single-figure composition instruction in the prompt — the model could decompose the outfit into elements and render some beside the figure. (2) The shortenPieceName() function used a naive split on "with" that stripped all "with X" clauses, including structurally defining ones. This is silent data loss in the prompt builder.
- **Resolution:** Fixed 2026-04-12. (1) Added explicit compositionInstruction to the prompt array: "ALL listed garments must be shown ON the single figure as a complete worn outfit — no floating items, no flat lay, no second figure, no garments beside or behind the figure." (2) Refactored shortenPieceName() to preserve "with X" clauses when the clause contains structural feature keywords (pocket, zip, button, buckle, strap, lace, hook, panel, patch, pleat, cuff, collar, hardware, seam). "— X" styling notes are still stripped. Word cap raised to 10 to accommodate kept clauses.

### INC-008 — Anchor duplicated in piece list (appears as both Anchor and Top/Outerwear)
- **Date observed:** 2026-04-12 (intermittent)
- **Feature area:** outfit display (results screen piece list)
- **Trigger conditions:** Outfit responses where OpenAI echoed the anchor item into keyPieces despite being told not to. More common on older cached responses predating the backend deduplication added in mapOutfitRecommendation.
- **Expected behavior:** The anchor item must appear exactly once in the piece list, labelled "Anchor", as the first row. It must not appear a second time as "Top", "Outerwear", or any other label.
- **Actual behavior:** In affected responses, the anchor appeared both as the first "Anchor" row and again as a "Top" or "Outerwear" row in the keyPieces section.
- **Frequency:** Intermittent — only affects cached responses where the backend deduplication hadn't run.
- **Example request ID or screenshot ref:** Observed in the results screen (LookResultCardView) only — TierDetailScreen/buildPiecesToCheck already had the safety net filter.
- **Notes:** The backend already deduplicates in mapOutfitRecommendation via deduplicateKeyPieces. However buildLabeledPieces (used by LookResultCardView on the results screen) lacked the client-side safety net that buildPiecesToCheck (used by TierDetailScreen) already had. This created an inconsistency between the two screens for stale cached responses.
- **Resolution:** Fixed 2026-04-12. Added anchor deduplication filter to buildLabeledPieces in look-result-card-helpers.ts, matching the existing safety net in buildPiecesToCheck/tier-detail-helpers.ts. keyPieces are now filtered against the normalizedAnchor before being mapped into the piece list rows.

### INC-009 — Anchor item replaced by different garment in sketch
- **Date observed:** 2026-04-12
- **Feature area:** sketch generation
- **Trigger conditions:** Black Quarter-Zip Pullover set as anchor. 
  Two separate outfit generations from the same anchor, both at 
  7:09 PM same session.
- **Expected behavior:** The sketch should show a black quarter-zip 
  pullover as the primary visible garment — the distinctive zip at 
  the collar and pullover silhouette should be clearly identifiable
- **Actual behavior:** Two completely different garments rendered 
  instead of the anchor:
  Instance 1: A dark olive/charcoal chore jacket or overshirt with 
  chest pockets and button placket — no quarter-zip visible at all. 
  Outerwear item listed as anchor in the piece list but sketch shows 
  a structured jacket, not a knit pullover.
  Instance 2: A black bomber jacket with ribbed cuffs, collar, and 
  hem — again no quarter-zip visible. The sketch reads as a bomber, 
  not a pullover.
  In both cases the anchor item label correctly says "Black 
  Quarter-Zip Pullover" in the piece list, but the sketch figure 
  is wearing an entirely different garment.
- **Frequency:** Two consecutive instances from the same anchor 
  in the same session — consistent failure for this garment type
- **Example request ID or screenshot ref:** Screenshots 7:09 PM — 
  both Smart Casual tier, both anchored on Black Quarter-Zip Pullover.
  Instance 1: pants: light stone slim-cut cotton trousers, top: white 
  crisp cotton poplin shirt, outerwear visible in sketch but not 
  matching anchor.
  Instance 2: pants: tapered stone stretch chinos, top: crisp white 
  heavyweight T-shirt layered underneath, outerwear: black bomber 
  visible in sketch instead of quarter-zip.
- **Notes:** This is a different failure mode from INC-001/003 
  (outerwear absent) and INC-002 (outerwear wrong color). Here the 
  anchor item is being actively replaced by a different garment 
  category entirely — a structured jacket instead of a knit pullover. 
  The sketch model appears to be conflating "black zip garment" with 
  outerwear categories (chore jacket, bomber) rather than rendering 
  the softer, knit pullover silhouette. Two hypotheses: (1) the 
  anchor item description in the sketch prompt is not specific enough 
  about the garment category — "quarter-zip pullover" may be 
  interpreted as any zip-front item, (2) when an outerwear piece is 
  also in the outfit, the model renders the outermost layer and 
  ignores the mid-layer anchor. This connects to the broader pattern 
  of anchor items being dropped or replaced — INC-001, INC-003, 
  INC-007, and now INC-009 all show the sketch model overriding 
  specified garment details. Ready to include in next Prompt 2 run.
- **Resolution:** Fixed 2026-04-12. Three concurrent fixes: (1) Added 'shirt', 't-shirt', 'polo', 'button-down' to MIDLAYER_ANCHOR_KEYWORDS so shirts are correctly classified as inner layers when outerwear is present — same treatment as knitwear. (2) Rewrote anchorLock to use ANCHOR INNER LAYER / ANCHOR PIECE authority language with categoryHint() which explicitly names the garment type and prohibits common substitutions ("NOT a jacket, NOT a bomber jacket, NOT a chore coat, NOT outerwear"). (3) Expanded knitwear/pullover antiDrift in anchor-drift-negatives.ts to include "bomber jacket, chore jacket, chore coat, field jacket, overshirt, zip-front jacket, outerwear jacket" — the exact garment types that appeared in INC-009.

### INC-010 — Anchor dress shirt rendered as blazer in sketch
- **Date observed:** 2026-04-12
- **Feature area:** sketch generation
- **Trigger conditions:** Rust Brown Dress Shirt set as anchor. 
  Smart Casual tier. Outfit also includes a Structured light taupe 
  wool-linen blazer as outerwear.
- **Expected behavior:** The sketch should show a rust/brown dress 
  shirt as the visible base layer under the taupe blazer, or if the 
  blazer is the outermost layer, the shirt collar and cuffs should 
  be visible peeking out. The anchor shirt's rust/brown color and 
  dress shirt silhouette should be identifiable.
- **Actual behavior:** The sketch shows a brown blazer jacket as the 
  primary outer garment. The anchor dress shirt's color (rust brown) 
  has been transferred to the outerwear layer — the blazer in the 
  sketch is rendered in the anchor's color rather than the specified 
  taupe. The dress shirt anchor is not visible at all.
- **Frequency:** Once — but part of a consistent pattern
- **Example request ID or screenshot ref:** Screenshot 7:33 PM — 
  Smart Casual tier, Modern Rust & Stone Contrast Tailored Spring 
  Edition. Anchor: Rust Brown Dress Shirt, outerwear: Structured 
  light taupe wool-linen blazer. Sketch shows a brown blazer — 
  anchor color applied to outerwear garment category.
- **Notes:** This is a compound failure combining two previously 
  observed patterns:
  (1) INC-002 pattern — anchor item color bleeding into outerwear 
  rendering. The rust brown of the dress shirt has transferred to 
  the blazer, which should be taupe.
  (2) INC-009 pattern — anchor item garment category replaced. 
  The dress shirt (soft, collared, base layer) has been replaced 
  by a blazer (structured, outerwear) in the sketch.
  The sketch model appears to be taking the anchor item's color and 
  applying it to the most visually prominent garment in the outfit 
  (the outerwear/blazer), while simultaneously ignoring the anchor's 
  actual garment type. This is now the fifth consecutive instance 
  of the anchor item being misrepresented in the sketch — INC-001, 
  INC-003, INC-009, and INC-010 all show anchor suppression or 
  replacement, and INC-002 and INC-010 both show anchor color 
  bleeding into outerwear. This pattern is systemic. The sketch 
  prompt is not establishing the anchor item as a fixed, immovable 
  element of the composition — the model is free to override it. 
  This must be the primary fix in the next Prompt 2 run.
- **Resolution:** Fixed 2026-04-12. Two concurrent fixes: (1) Added 'shirt' to MIDLAYER_ANCHOR_KEYWORDS — dress shirts were entirely absent from this list, so "Rust Brown Dress Shirt" was classified as an anchor-worn (outermost) item even when outerwear was present, creating a direct conflict with the outerwear slot. Now shirts are reframed as "ANCHOR INNER LAYER — worn under the outermost layer" when outerwear exists. (2) Added colorContrastClause to the prompt: when anchor and outerwear have different color words in their descriptions, an explicit clause is injected — "color distinction — anchor is [rust], outerwear is [taupe]: render each layer in its own specified color, do not transfer anchor color to outerwear." This directly addresses the color-bleed failure where the anchor's rust color was applied to the taupe blazer.

---

### INC-001 — Outerwear item absent from sketch
- **Date observed:** 2026-04-11
- **Feature area:** sketch generation
- **Trigger conditions:** Outfit includes an outerwear layer (suit jacket) 
  worn over a base layer (quarter zip sweater). The anchor item is the 
  sweater, not the jacket.
- **Expected behavior:** Sketch should show the full outfit as recommended — 
  charcoal suit jacket worn over the navy quarter zip and white dress shirt
- **Actual behavior:** Sketch shows only the navy quarter zip, white dress 
  shirt, and trousers. The charcoal tropical wool suit jacket is completely 
  absent from the illustration despite being listed as the outerwear piece.
- **Frequency:** Once (first observed)
- **Example request ID or screenshot ref:** screenshots/INC-001-IMG_5974.PNG — 
  anchor: Navy Quarter Zip Sweater, outerwear: Tailored charcoal tropical 
  wool suit jacket, pants: Tailored charcoal tropical wool suit trousers, 
  top: Crisp white spread collar dress shirt
- **Notes:** Hypothesis — the sketch prompt may be anchoring too heavily on 
  the anchor item (quarter zip) and not incorporating the full outfit piece 
  list, causing the outermost layer to be dropped. Outerwear omission may 
  be more likely when the anchor is a mid-layer rather than the outermost piece.
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). When anchor is a mid-layer and outerwear is present, anchor lock is reframed as "inner layer worn under outerwear" and outerwear gets its own "outermost layer" prompt slot. Further hardened 2026-04-12: anchor lock rewritten with explicit ANCHOR INNER LAYER authority language and categoryHint() prohibition terms; compositionInstruction added to enforce single-figure composition; MIDLAYER_ANCHOR_KEYWORDS expanded to include shirts/tops.

### INC-002 — Outerwear color incorrect in sketch
- **Date observed:** 2026-04-11
- **Feature area:** sketch generation
- **Trigger conditions:** Outfit includes a light grey outerwear layer over 
  a navy quarter zip anchor item. Two navy pieces in the outfit (anchor 
  sweater + navy belt). Outerwear is a different color family entirely 
  (grey/herringbone).
- **Expected behavior:** Sketch should show an unstructured light grey 
  herringbone blazer as the outermost layer
- **Actual behavior:** Sketch shows a navy blazer — likely inheriting the 
  color of the anchor item (navy quarter zip) rather than rendering the 
  specified outerwear color
- **Frequency:** Once (second outerwear-related inconsistency observed)
- **Example request ID or screenshot ref:** screenshots/INC-002-pieces.png (piece list), screenshots/INC-002-sketch.png (sketch) — 
  anchor: Navy Quarter Zip Sweater, outerwear: Unstructured light grey 
  herringbone blazer, pants: Tailored off-white flat-front trousers, 
  top: Light blue cotton poplin shirt semi-spread collar, 
  shoes: Stone suede loafers, accessory: Muted navy braided leather belt
- **Notes:** Likely related to INC-001. The sketch model may be anchoring 
  on the most visually dominant or first-listed item color when rendering 
  outerwear, rather than honoring the outerwear's specified color and 
  texture. The navy quarter zip color appears to be bleeding into the 
  blazer render. INC-001 and INC-002 together suggest a systematic issue 
  with how the anchor item influences sketch generation — either dominating 
  color decisions or suppressing the outermost layer entirely. Both 
  inconsistencies involve a navy anchor with a non-navy outerwear piece.
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Outerwear now declared in its own high-weight slot with explicit color from piece description, separate from the anchor lock. Further hardened 2026-04-12: colorContrastClause added to prompt — when anchor and outerwear have different color words, an explicit "color distinction" instruction is injected naming both colors and prohibiting color transfer between layers.

### INC-003 — Outerwear absent from sketch (third instance, same anchor)
- **Date observed:** 2026-04-11
- **Feature area:** sketch generation
- **Trigger conditions:** Outfit includes a charcoal herringbone blazer as 
  outerwear over a navy quarter zip anchor item. Same anchor item as INC-001 
  and INC-002.
- **Expected behavior:** Sketch should show a single-breasted charcoal 
  herringbone wool blazer worn as the outermost layer over the quarter zip
- **Actual behavior:** Sketch shows only the navy quarter zip, dress shirt, 
  trousers, and shoes. The charcoal herringbone blazer is completely absent — 
  identical failure mode to INC-001.
- **Frequency:** Third occurrence. INC-001, INC-002, and INC-003 all share 
  the same anchor item (Navy Quarter Zip Sweater) and all involve outerwear 
  either being absent or rendered incorrectly.
- **Example request ID or screenshot ref:** screenshots/INC-003-sketch.png — 
  anchor: Navy Quarter Zip Sweater, outerwear: Single-breasted charcoal 
  herringbone wool blazer tailored, tier: Business / Refined Business Edge
- **Notes:** This is now a confirmed pattern, not a one-off. Three 
  consecutive outfits with the Navy Quarter Zip Sweater as anchor have all 
  failed to render outerwear correctly — either dropping it entirely (INC-001, 
  INC-003) or rendering it in the anchor's color instead of the specified 
  color (INC-002). The anchor item is almost certainly dominating the sketch 
  prompt in a way that either suppresses outerwear rendering or overrides its 
  color. This is ready for Prompt 2 — sufficient evidence to diagnose and fix.
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Same fix as INC-001. Further hardened 2026-04-12: categoryHint() now explicitly names "NOT a jacket, NOT a bomber jacket, NOT a chore coat" for knitwear anchors; expanded antiDrift in anchor-drift-negatives.ts covers bomber/chore/field jacket substitutions.

### INC-004 — Phantom second figure + outerwear rendered as flat lay instead of worn
- **Date observed:** 2026-04-11
- **Feature area:** sketch generation
- **Trigger conditions:** Outfit includes a taupe chore blazer as outerwear 
  over a navy quarter zip anchor item. Same anchor as INC-001, INC-002, 
  INC-003. Accessories include sunglasses.
- **Expected behavior:** A single mannequin figure wearing all pieces as a 
  complete dressed outfit — navy quarter zip under a structured taupe chore 
  blazer, stone chino trousers, brown derby shoes. One figure only.
- **Actual behavior:** Two failure modes in a single sketch:
  1. A second headless half-figure appears in the background wearing the 
     taupe blazer, rather than the blazer being worn on the main figure
  2. The outerwear and accessories (sunglasses, loafers) are rendered as 
     flat-lay or ghost items floating beside the main figure rather than 
     being integrated into a single dressed look
  The main figure shows only the navy quarter zip, chinos, and brown shoes — 
  the outerwear is again absent from the primary figure.
- **Frequency:** Once (fourth outerwear-related inconsistency, same anchor)
- **Example request ID or screenshot ref:** screenshots/INC-004-sketch.png — 
  anchor: Navy Quarter Zip Sweater, outerwear: Structured taupe lightweight 
  chore blazer (unlined), pants: Tailored flat-front stone chino trousers, 
  top: White poplin spread-collar shirt (open at neck), shoes: brown derbies
- **Notes:** This is a more severe failure than INC-001/003 (absent outerwear) 
  and INC-002 (wrong color). The sketch model appears to be decomposing the 
  outfit into separate visual elements rather than composing them onto a 
  single figure. The second phantom figure suggests the model is attempting 
  to render the blazer but cannot reconcile it with the anchor-dominated 
  primary figure, so it generates a second figure as a fallback. This 
  strongly implies the sketch prompt is not communicating layering order or 
  single-figure composition constraints clearly enough. All four inconsistencies 
  share the same anchor — ready for Prompt 2.
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Explicit layering order in prompt removes the conflicting signal that caused the model to split the outfit across two figures. Further hardened 2026-04-12: compositionInstruction added — "ALL listed garments must be shown ON the single figure as a complete worn outfit — no floating items, no flat lay, no second figure, no garments beside or behind the figure."
