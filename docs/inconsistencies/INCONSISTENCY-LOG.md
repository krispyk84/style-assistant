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

---

## Resolved Inconsistencies

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
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). When anchor is a mid-layer and outerwear is present, anchor lock is reframed as "inner layer worn under outerwear" and outerwear gets its own "outermost layer" prompt slot. Re-test with same anchor + outerwear combination to confirm.

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
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Outerwear now declared in its own high-weight slot with explicit color from piece description, separate from the anchor lock. Re-test with grey/non-navy outerwear over navy anchor to confirm color bleed is resolved.

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
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Same fix as INC-001.

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
- **Resolution:** Fixed in commit `ff71c468` (2026-04-11). Explicit layering order in prompt removes the conflicting signal that caused the model to split the outfit across two figures. Re-test with taupe/non-navy outerwear over navy anchor with accessories to confirm phantom figure is gone.
