# Update Tracker

## 2026-04-12 — Sketch inconsistency fix session (INC-005 through INC-010)

Diagnosed and fixed six root causes behind ten documented sketch/display inconsistencies.

**INC numbers addressed:** INC-001 (hardened), INC-002 (hardened), INC-003 (hardened), INC-004 (hardened), INC-005, INC-007, INC-008, INC-009, INC-010. INC-006 not yet documented — left open.

**Root causes fixed:**

1. **Headless constraint (INC-005)** — HEADLESS_CLOSING strengthened from a soft "remember" reminder to an absolute prohibition statement. Moved to the very last token position in the prompt array (was before the style block, now after it). Added neck/jaw suppression terms to fal-prompt-builder.ts NEGATIVE_PROMPT: "neck above collar line, exposed neck skin, jawline, chin above collar, visible neck, bare neck."

2. **Anchor authority insufficient (INC-001, INC-003, INC-009, INC-010)** — Rewrote `anchorLock` in `sketch.prompts.ts`. Was: "inner layer worn: [anchor], preserve garment category and all construction details exactly". Now: "ANCHOR INNER LAYER — must be rendered exactly as described, visible under outerwear: [anchor]. This is a [categoryHint], worn under the outermost layer." Added `categoryHint()` helper that names the garment type AND its most common wrong substitutions (e.g. "NOT a jacket, NOT a bomber jacket, NOT a chore coat, NOT outerwear" for quarter-zip pullovers).

3. **Dress shirt not classified as mid-layer (INC-010)** — Added 'shirt', 't-shirt', 'polo', 'button-down' to `MIDLAYER_ANCHOR_KEYWORDS`. Shirts were entirely absent, causing dress shirt anchors to be declared as outer-layer items even when outerwear was present, creating a direct conflict with the outerwear slot.

4. **Anchor color bleeding into outerwear (INC-002, INC-010)** — Added `colorContrastClause` to the prompt array. When anchor and outerwear have different color words, injects: "color distinction — anchor is [color], outerwear is [color]: render each layer in its own specified color, do not transfer anchor color to outerwear."

5. **Anti-drift negatives missed bomber/chore jacket (INC-009)** — Expanded knitwear/pullover antiDrift in `anchor-drift-negatives.ts` from "blazer, suit jacket, sport coat, structured jacket, woven jacket" to also include "bomber jacket, chore jacket, chore coat, field jacket, overshirt, zip-front jacket, outerwear jacket." Added `quarter.?zip`, `half.?zip`, `turtleneck` to the matching regex.

6. **Outerwear flat-lay / single-figure composition (INC-004, INC-007)** — Added `compositionInstruction` to prompt array: "ALL listed garments must be shown ON the single figure as a complete worn outfit — no floating items, no flat lay, no second figure, no garments beside or behind the figure."

7. **Structural feature clauses stripped from piece names (INC-007)** — Refactored `shortenPieceName()` to preserve "with X" / "featuring X" clauses when the clause contains structural feature keywords (pocket, zip, button, buckle, strap, lace, hook, panel, patch, pleat, cuff, collar, hardware, seam). Word cap raised from 8 to 10 to accommodate kept clauses.

8. **Anchor duplicated in piece list (INC-008)** — Added anchor deduplication safety net to `buildLabeledPieces` in `look-result-card-helpers.ts`, matching the existing filter in `buildPiecesToCheck`. Guards against stale cached responses where OpenAI echoed the anchor into keyPieces, causing it to appear twice in the results screen piece list.

**Files changed:**
- `backend/src/ai/fal-prompt-builder.ts` — expanded NEGATIVE_PROMPT (neck terms)
- `backend/src/ai/prompts/sketch.prompts.ts` — HEADLESS_CLOSING, MIDLAYER_ANCHOR_KEYWORDS, categoryHint(), shortenPieceName(), anchorLock, colorContrastClause, compositionInstruction, prompt array reorder
- `backend/src/modules/outfits/anchor-drift-negatives.ts` — expanded knitwear antiDrift
- `components/cards/look-result-card-helpers.ts` — anchor dedup in buildLabeledPieces

**Stress tests to run:**
- Quarter-zip pullover anchor + outerwear: sketch must show a knit pullover, not a bomber or chore coat
- Rust/brown dress shirt anchor + taupe blazer: sketch must show rust shirt under taupe blazer, not a brown blazer
- Any anchor + outerwear where anchor and outerwear differ in color: outerwear must render in its own color
- Cargo pants in outfit: "with large side cargo pockets" must be visible in the sketch
- Multiple sequential outfit generations with same anchor: no face, no head in any sketch
- Results screen with stale cached response: anchor must appear exactly once in piece list

## 2026-04-11 — Full frontend modularisation (Phase 1–4)

Split 15 monolithic screen and component files into hook + view + entry layers across two sessions.

**Scope:** 30+ new files created. Every modified original either became a single re-export line or was rewritten in-place.

**Files split:**
- `components/cards/look-result-card.tsx` → `look-result-card-helpers.ts`, `useLookResultCard.ts`, `TierPieceListView.tsx`, `LookResultCardView.tsx`
- `app/tier/[tier].tsx` → `tier-detail-helpers.ts`, `useTierDetailData.ts`, `useTierDetailMatching.ts`, `useTierDetailActions.ts`, `TierDetailScreen.tsx`
- `lib/look-route.ts` → `look-route-serializers.ts` (serializers extracted; circular dependency prevented by keeping `buildLookResultsHref` in source file)
- `app/check-piece.tsx` → `useCheckPieceImage.ts`, `useCheckPieceAnalysis.ts`, `useCheckPieceSave.ts`, `CheckPieceScreen.tsx`
- `app/(app)/history.tsx` → `useFavouritesData.ts`, `useHistoryData.ts`, `useHistoryActions.ts`, `LooksScreen.tsx`
- `components/closet/closet-item-sheet.tsx` (read-only; actual logic was in `app/(app)/closet.tsx`) → `useClosetItemEditor.ts`, `useClosetItemSubmit.ts`, `ClosetItemSheetView.tsx`
- `app/(app)/settings.tsx` → `useSettings.ts`, `useLogout.ts`, `SettingsScreen.tsx`
- `components/second-opinion/stylist-chooser-modal.tsx` → `useSecondOpinionRequest.ts`, `StylistOpinionResultView.tsx`, `StylistChooserModalView.tsx`
- `app/(app)/week.tsx` → `useWeekPlan.ts`, `useWeekPlanActions.ts`, `WeekScreen.tsx`
- `app/(app)/home.tsx` → `useHomeData.ts` (screen rewritten in-place; no separate entry needed)

**Pattern established:** hook-first creation order; entry files as single re-export lines; cross-hook coordination via coordinator functions in screens; state setter params for sibling hook mutation; `getFields()` snapshot for form hooks.

**Outcome:** Zero new TypeScript errors introduced. Four pre-existing errors in unrelated files remain.

**Not split (deferred):** `app/create-look.tsx`, `app/review-request.tsx`, `app/selfie-review.tsx`, `app/camera-capture.tsx`, `app/(app)/profile.tsx`, `app/results/[requestId].tsx` (partial).
