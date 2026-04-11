# Backlog

---

## Bugs

**[Logout / Data isolation]** — `clearAllLocalUserData` (called on `SIGNED_OUT` in `useAuthSideEffects.ts`) only clears four keys: closet-items, saved-outfits, week-plan, and session. It does not clear `match-feedback-storage`, `profile-storage`, `app-settings-storage`, or `weather-storage`. On a shared device, the next user's session could see the previous user's match feedback, cached profile, and sensitivity setting.
*Evidence: `lib/user-data-sync.ts:12–19`, `contexts/useAuthSideEffects.ts:44–46`*

**[TypeScript / SettingsScreen]** — `SettingsScreen.tsx:233,244` passes percent strings (`'50%'`, `'0%'`) to `width` and `left` in a strict `ViewStyle`. These are rejected by the type checker but accepted at runtime. If a future RN upgrade tightens runtime validation this will break the sensitivity slider rendering.
*Evidence: `app/(app)/SettingsScreen.tsx:233,244` (pre-existing)*

**[TypeScript / Image picker]** — `hooks/use-image-picker.ts:95` passes `allowsMultipleSelection: true` to a type that doesn't include it in the current SDK version. Multi-select may silently fall back to single-select on some targets.
*Evidence: `hooks/use-image-picker.ts:95` (pre-existing)*

**[TypeScript / AsyncStorage]** — `lib/user-data-sync.ts:19` calls `AsyncStorage.multiRemove` which is missing from the imported type definition. The runtime call works, but the type gap means the compiler can't catch misuse.
*Evidence: `lib/user-data-sync.ts:19` (pre-existing)*

**[TypeScript / Results data]** — `app/results/useResultsData.ts:112` spreads a value typed as a non-object. If the API ever returns an unexpected shape here the spread will throw at runtime with no type guard.
*Evidence: `app/results/useResultsData.ts:112` (pre-existing)*

**[Home / Carousel]** — The carousel `setInterval` keeps firing even when the home tab is not focused (`isFocusedRef.current === false`). The guard skips the Animated call but the interval still wakes up every 10 s. On a device with many saved outfits this is unnecessary timer pressure while on other tabs.
*Evidence: `app/(app)/useHomeData.ts:48–69`*

**[Dead code / use-home-preview]** — `hooks/use-home-preview.ts` returns mock data (anchorItem, outfitResults) and is not imported anywhere. It is described in CLAUDE.md as "legacy — superseded by useHomeData" but has not been removed.
*Evidence: `hooks/use-home-preview.ts`; zero grep hits for `use-home-preview` in non-test source files*

**[Backend / Prisma `as any`]** — `outfits.repository.ts`, `style-guide.repository.ts`, `selfie-review.repository.ts`, `uploads.repository.ts`, and `compatibility.repository.ts` cast `prisma` (or a transaction) to `any` before querying. This bypasses all Prisma type safety for those queries. Likely caused by models added to the schema after `prisma generate` was last run in the type-checked context, or a Prisma version mismatch.
*Evidence: `backend/src/modules/outfits/outfits.repository.ts:40–43,94`, `backend/src/modules/style-guides/style-guide.repository.ts:7,27,30`, and similar*

---

## Feature Ideas

**[Closet]** — Item history: show which saved outfits a specific closet item has appeared in. Currently you can only browse outfits from the history screen; there's no reverse lookup from item → outfits. Useful for identifying overused or underused pieces.

**[Data sync]** — Multi-device sync gap: `match-feedback-storage`, `profile-storage`, and `app-settings-storage` are local-only and not included in `syncUserDataOnSignIn`. A user switching devices loses their match thumbs-up/down signals and sensitivity setting. Consider adding them to the sync entity list.
*Evidence: `lib/user-data-sync.ts:31–36`*

**[Style guides]** — The backend has a full `style-guides` module (service, repository, DB model, epub ingestion path) but there is no admin or user-facing UI to manage or update the active style guide. The source path is hardcoded to `Esquire-2024.epub` in `backend/src/config/env.ts:24`. A simple admin endpoint or config toggle to swap the active document would make the feature usable without a code deploy.
*Evidence: `backend/src/modules/style-guides/`, `backend/src/config/env.ts:24`*

**[Closet / Look request]** — `image-picker-field.tsx` exposes a `futureCameraHint` prop but no callsite currently passes a non-null value. The prop exists as a placeholder for a camera workflow hint. Consider either wiring it up or removing it.
*Evidence: `components/forms/image-picker-field.tsx:16,31,70`*

---

## Architecture Questions

**[Data sync]** — Is it intentional that `match-feedback-storage`, `profile-storage`, `app-settings-storage`, and `weather-storage` are excluded from both `clearAllLocalUserData` and `syncUserDataOnSignIn`? App settings (sensitivity) and match feedback semantics are different from closet data, but the current split is undocumented. Decide: (a) per-device always, (b) sync on sign-in but not wipe on sign-out, or (c) sync and wipe.

**[Data sync / Conflict resolution]** — `syncUserDataOnSignIn` uses a cloud-wins strategy: if the cloud has any records, local data is overwritten silently. There is no merge. If a user makes closet changes on device A while offline, then signs in on device B (which pushes its data to cloud), then signs back in on device A, device A loses its offline changes. Is the cloud-wins strategy the intended permanent design, or is merge needed?
*Evidence: `lib/user-data-sync.ts:44–55`*

**[Backend / Prisma `as any`]** — Multiple repositories cast `prisma` to `any` to access models. Is the Prisma client out of date (models added to schema but `prisma generate` not re-run in the CI/deploy pipeline), or is this a known SDK version mismatch? Resolving this would restore type safety across all DB queries in those modules.

**[Hook exhaustive-deps suppressions]** — Several hooks suppress `react-hooks/exhaustive-deps` (e.g., `useTierDetailMatching.ts:54,81`, `useResultsPolling.ts:60`, `useResultsMatchFeedback.ts:37,83`, `useClosetItemEditor.ts:79`). Some are intentional (stable refs, mount-only effects). An audit pass would confirm which are safe and which may hide stale-closure bugs, and replace suppressions with explicit `useRef` patterns where the dep is genuinely stable.

**[Unmodularized screens]** — `app/create-look.tsx`, `app/review-request.tsx`, `app/selfie-review.tsx`, `app/camera-capture.tsx`, and `app/(app)/profile.tsx` have not been reviewed or split. Before splitting, confirm whether any of these screens are candidates for removal or significant redesign (particularly `camera-capture.tsx` given the recent camera flip + countdown work), so the modularization effort targets the final shape.
