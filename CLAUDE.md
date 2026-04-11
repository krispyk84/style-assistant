# Vesture — Claude Working Reference

## Project

Vesture is an AI-powered personal style assistant. Users build a digital closet, generate outfit recommendations for occasions and weather, receive second opinions from AI stylists, and plan a 7-day outfit calendar. The backend generates recommendations via OpenAI and produces fashion sketches via Fal / Gemini / Imagen.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Expo SDK, React Native, TypeScript, expo-router (file-based routing) |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| AI | OpenAI (outfit generation, closet analysis, second opinions), Fal / Gemini / Imagen (sketch generation) |
| Auth | Supabase Auth |
| DB | Supabase (PostgreSQL via Prisma) |
| Storage | Supabase Storage (images), AsyncStorage (local device state) |

## Deploy

- **Backend**: `git push origin main` → auto-deploys to Render
- **iOS**: `npm run deploy` → xcodebuild to connected iPhone

## Repo Structure

```
app/                        Expo Router screens (file-based routes)
  (app)/                    Authenticated tab screens
    closet.tsx              Closet coordinator + ClosetItemSheetView mount point
    ClosetScreenView.tsx    Closet grid UI
    useClosetData.ts        Item loading, polling, categories
    useClosetNavigation.ts  Selection, filter, scroll, edit state
    useClosetAnimations.ts  Shimmer animation
    closet-grid-utils.ts    Column/row calculation helpers
    history.tsx             → re-exports LooksScreen
    LooksScreen.tsx         Favourites + History tab UI
    useFavouritesData.ts    Saved outfits load/delete + sketch hydration
    useHistoryData.ts       History load/delete + HistoryCard type
    useHistoryActions.ts    Week assignment for favourites
    home.tsx                Home screen (in-place, calls useHomeData)
    useHomeData.ts          Weather + profile + carousel state
    settings.tsx            → re-exports SettingsScreen
    SettingsScreen.tsx      Settings UI (appearance, sensitivity, version)
    useSettings.ts          Sensitivity load/save, AI cost fetch
    useLogout.ts            signOut wrapper (placeholder for cleanup)
    week.tsx                → re-exports WeekScreen
    WeekScreen.tsx          7-day calendar UI
    useWeekPlan.ts          Week plan load + sketch hydration
    useWeekPlanActions.ts   Save outfit, remove from week
    profile.tsx             Profile screen (not yet split)
  tier/
    [tier].tsx              → re-exports TierDetailScreen
    TierDetailScreen.tsx    Tier detail UI + modals
    useTierDetailData.ts    Route params, closet fetch, sketch poll
    useTierDetailMatching.ts Closet matching, feedback, sheet state
    useTierDetailActions.ts Second opinion visibility, navigation
    tier-detail-helpers.ts  Pure helpers: buildPiecesToCheck, labelForKeyPiece
  results/
    [requestId].tsx         Results screen (partially split — hooks extracted)
    useResultsData.ts       Outfit result loading + sketch hydration
    useResultsPolling.ts    Sketch status polling
    useResultsActions.ts    Save, week assignment, navigation
    useResultsMatchFeedback.ts Match feedback wiring
  check-piece.tsx           → re-exports CheckPieceScreen
  CheckPieceScreen.tsx      Check-a-piece UI
  useCheckPieceImage.ts     Image pick/upload + closet picker state
  useCheckPieceAnalysis.ts  AI analysis request + result state
  useCheckPieceSave.ts      Save-to-closet modal state
  onboarding.tsx            → re-exports OnboardingScreen
  OnboardingScreen.tsx      Onboarding UI
  useOnboardingFlow.ts      Step progression, completion
  useOnboardingForms.ts     Form field state per step
  onboarding-mappers.ts     Input → API request mappers
  create-look.tsx           Create look screen (not yet split)
  review-request.tsx        Request review screen (not yet split)
  selfie-review.tsx         Selfie review screen (not yet split)
  camera-capture.tsx        Camera capture screen (not yet split)
  auth/                     Unauthenticated screens (sign-in, sign-up, etc.)

components/
  cards/
    look-result-card.tsx    → re-exports LookResultCardView
    LookResultCardView.tsx  Full tier card with match overlay
    useLookResultCard.ts    Labeled pieces + matched piece state
    look-result-card-helpers.ts Pure: resolveMatch, buildLabeledPieces
    TierPieceListView.tsx   Piece row list with match indicators
    outfit-result-card.tsx  Saved/history outfit card
    look-tier-detail-card.tsx Tier detail card
    weather-card.tsx        Weather display card
    (+ action, profile, mock cards)
  closet/
    closet-item-sheet.tsx   → re-exports ClosetItemSheetView
    ClosetItemSheetView.tsx Full item view/edit modal
    useClosetItemEditor.ts  15 form fields + AI autofill + getFields()
    useClosetItemSubmit.ts  updateItem, deleteItem HTTP calls
    save-to-closet-modal.tsx → re-exports SaveToClosetModalContainer
    SaveToClosetModalContainer.tsx Save flow coordinator
    SaveToClosetForm.tsx    Save form UI
    useSaveToClosetForm.ts  Form field state
    useSaveToClosetSubmit.ts HTTP submit
    closet-picker-modal.tsx Item selection picker
    closet-form-mappers.ts  Field → API request mappers
    (+ picker components: color-family, fit-status, formality, pattern, season, silhouette, weight)
  forms/
    create-look-request-form.tsx → re-exports CreateLookRequestFormContainer
    CreateLookRequestFormContainer.tsx Request form coordinator
    CreateLookRequestFormView.tsx Request form UI
    useCreateLookRequestForm.ts Form state
    useAnchorItemsForm.ts   Anchor items field state
    createLookRequest-mappers.ts Field → API mappers
    profile-form.tsx        → re-exports ProfileFormView
    ProfileFormView.tsx     Profile form UI
    useProfileForm.ts       Profile form state
    useProfileFormSubmit.ts Profile HTTP submit
    profile-form-mappers.ts Field → API mappers
    prompt-composer.tsx     Freeform prompt input
    image-picker-field.tsx  Image pick/upload field
  second-opinion/
    stylist-chooser-modal.tsx → re-exports StylistChooserModal
    StylistChooserModalView.tsx Modal shell + stylist grid
    StylistOpinionResultView.tsx Result display (quote card + reset)
    useSecondOpinionRequest.ts HTTP request, result state, clearResult
  ui/                       Shared primitives (AppText, AppScreen, PrimaryButton, etc.)
  weather/                  WeatherForecastModal
  week/                     WeekPickerModal

hooks/
  use-app-session.ts        Profile + session state (context wrapper)
  use-current-weather.ts    Weather fetch + formatting
  use-image-picker.ts       Image library / camera access
  use-uploaded-image.ts     Pick + upload composite (wraps use-image-picker)
  use-match-feedback.ts     Thumbs up/down feedback + re-match trigger
  use-match-sensitivity.ts  Reads closet match sensitivity from settings
  use-home-preview.ts       (legacy — superseded by useHomeData)

lib/
  look-route.ts             buildLookRouteParams, parseLookInput, buildTierHref
  look-route-serializers.ts URL encode/decode helpers, legacy compat
  look-route-params.ts      Type definitions for route params
  closet-match.ts           findBestClosetMatch entry point
  closet-match-scoring.ts   Score calculation
  closet-match-fuzzy.ts     Fuzzy string matching
  closet-match-taxonomy.ts  Category/subcategory taxonomy
  closet-match-weights.ts   Field weight constants
  analytics.ts              trackEvent wrappers
  crashlytics.ts            recordError wrapper
  app-settings-storage.ts   Sensitivity + other app prefs (AsyncStorage)
  saved-outfits-storage.ts  Favourites CRUD (AsyncStorage)
  week-plan-storage.ts      Week plan CRUD (AsyncStorage)
  closet-storage.ts         Closet counters (AsyncStorage)
  weather-storage.ts        Cached forecast (AsyncStorage)
  match-feedback-storage.ts Match feedback (AsyncStorage)
  profile-storage.ts        Local profile cache (AsyncStorage)
  outfit-utils.ts           formatTierLabel, weatherIconName
  temperature-format.ts     formatTemperatureRange
  stylists.ts               STYLISTS array + StylistId type
  supabase.ts               Supabase client
  api/api-client.ts         Authenticated fetch wrapper

services/                   API service layer (interface + api + mock per domain)
  closet/, compatibility/, outfits/, profile/
  second-opinion/, selfie-review/, uploads/, usage/
  weather/                  current-weather-service, api client, parser, hints

types/                      Shared TypeScript types
  api.ts                    API request/response types
  closet.ts                 ClosetItem + option constants
  look-request.ts           LookRecommendation, OutfitPiece, etc.
  style.ts                  SavedOutfit, WeekPlannedOutfit, etc.

constants/
  theme.ts                  Design tokens (colors, spacing, fonts)
  themes.ts                 Light/dark theme definitions
  config.ts                 App-wide constants

contexts/
  auth-context.tsx          useAuth hook + AuthProvider
  theme-context.tsx         useTheme + AppearanceMode
  app-session-context.tsx   Session state shape
  app-session-provider.tsx  Session hydration + saveProfile
  useSupabaseAuth.ts        Supabase session listener
  useAuthSideEffects.ts     Post-auth side effects

backend/src/
  modules/                  Feature modules (closet, outfits, profile, etc.)
  ai/                       AI clients + prompt builders (OpenAI, Fal, Gemini, Imagen)
  middleware/               auth, error-handler, request-logger
  config/                   env, logger, storage
  lib/                      api-response, async-handler, http-error, validation
  storage/                  S3 + local storage providers
```

## Key Conventions

### Modularization pattern
Every complex screen or component is split into three layers, created in this order:
1. **Hook(s)** (`use*.ts`) — all state, effects, and logic; no JSX
2. **View** (`*Screen.tsx` / `*View.tsx`) — pure UI; calls hooks and renders
3. **Entry** (`*.tsx` at the Expo Router path) — single re-export line

Entry files exist only to satisfy Expo Router's file-based routing. Never put logic in them.

### Cross-hook coordination
When hook A needs to update state owned by hook B, the screen assembles a coordinator function. Hook B passes its state setter out; the screen wires them together. Hooks never import each other.

### State setter params
Hooks that perform mutations receive state setters as constructor params:
```ts
useWeekPlanActions({ setItems, setSavedOutfitIds, savedOutfitIds })
useClosetItemSubmit({ item, setError, setIsEditing, onSaved, onDeleted })
```

### getFields() snapshot pattern
Form hooks expose a `getFields(): FieldType` function that snapshots all field values at call time. The submit hook calls `handleSave(editor.getFields())` rather than holding a reference to the editor hook.

### useFocusEffect
Always use `useFocusEffect(useCallback(...))`, never `useEffect([isFocused])`. The latter fires on both focus gain and loss, causing concurrent hydration calls with racing isMounted closures.

### Rules of Hooks
All hook calls must appear before any conditional return. If a screen has an early return (`if (!data) return <ErrorState />`), every hook still executes above it.

### Mapper pattern
Field values → API request shapes are handled in dedicated `*-mappers.ts` files, not inline in submit hooks or form components.

### Service layer
Each domain has: `*-service.ts` (interface), `api-*-service.ts` (real impl), `mock-*-service.ts` (mock), `index.ts` (exports the active impl based on env flag).

### Static theme
`theme` is imported directly from `@/constants/theme` (static object). `useTheme()` is used only when the component needs to respond to appearance mode changes at runtime.

## Open Debt

### Unmodularized screens
- `app/create-look.tsx` — not reviewed or split
- `app/review-request.tsx` — not reviewed or split
- `app/selfie-review.tsx` — not reviewed or split
- `app/camera-capture.tsx` — not reviewed or split
- `app/(app)/profile.tsx` — not reviewed or split
- `app/results/[requestId].tsx` — hooks extracted but screen file not reviewed

### useLogout.ts
Currently a one-line wrapper around `signOut`. Intended as the placeholder for logout cleanup (AsyncStorage clear, cache wipe, analytics flush). Needs real content when logout flow expands.

### Pre-existing TypeScript errors (not caused by modularization)
- `app/(app)/SettingsScreen.tsx:233,244` — SensitivitySlider `width`/`left` percent strings rejected by strict ViewStyle
- `app/results/useResultsData.ts:112` — spread on non-object type
- `hooks/use-image-picker.ts:95` — `allowsMultipleSelection` not in type
- `lib/user-data-sync.ts:19` — `multiRemove` not in AsyncStorage type
