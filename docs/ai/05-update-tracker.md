# Update Tracker

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
