// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { CreateLookInput } from '@/types/look-request';
import type { ClosetItem } from '@/types/closet';
import type { GenerateOutfitsResponse } from '@/types/api';

// ── Why this file exists (Phase R2) ──────────────────────────────────────────
//
// app/results/MultiLookResults.tsx cannot be imported under this test runner
// as-is: it (and every UI component it imports — LookResultCard, AppScreen,
// the modals, etc.) transitively pulls in the real `react-native` package,
// whose source uses Flow syntax vitest/rolldown cannot parse ("Flow is not
// supported", confirmed by direct probe before writing this file). This repo
// has no @testing-library/react-native and no existing precedent anywhere
// for rendering a screen-level RN component under vitest — introducing that
// capability would be a real test-infrastructure change, not a "tiny
// testability seam", so per this phase's own instructions this file does
// NOT attempt it. Nothing in app/results/MultiLookResults.tsx itself was
// changed to make this possible — every mock below lives in this test file.
//
// Instead, every DIRECT import of MultiLookResults.tsx that would itself
// pull in react-native (or native-module-backed storage/analytics) is
// mocked at the module boundary — wrapping components render their
// children through (so nested components still get instantiated), leaf UI
// components are vi.fn(() => null) so their exact PROPS are inspectable via
// .mock.calls without touching the DOM or component internals at all. This
// tests MultiLookResults's REAL handler closures (handleSave,
// handleAssignToWeek, handleOutfitFeedback, the polling effect, the
// matchMaps computation) exactly as they exist today — not a
// reimplementation — by rendering the real component function and reading
// what it actually passes to its real children/calls on its real
// dependencies. lib/closet-match's findBestClosetMatch is deliberately left
// UNMOCKED (real) specifically so the match-scoring tests below prove
// MultiLookResults uses the exact same shared primitive as everywhere else
// in the app, not an approximation of it.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => props.children ?? null,
  Pressable: (props: { children?: unknown }) => props.children ?? null,
}));

const LookResultCardMock = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/components/cards/look-result-card', () => ({ LookResultCard: (props: unknown) => LookResultCardMock(props as Record<string, unknown>) }));

vi.mock('@/components/cards/look-request-review-card', () => ({ LookRequestReviewCard: () => null }));

vi.mock('@/components/closet/save-to-closet-modal', () => ({ SaveToClosetModal: () => null }));

vi.mock('@/components/ui/app-screen', () => ({ AppScreen: (props: { children?: unknown }) => props.children ?? null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => props.children ?? null }));
vi.mock('@/components/ui/error-state', () => ({ ErrorState: () => null }));
vi.mock('@/components/ui/loading-state', () => ({ LoadingState: () => null, extendedFashionLoadingMessages: [] }));
vi.mock('@/components/ui/primary-button', () => ({ PrimaryButton: () => null }));
vi.mock('@/components/ui/screen-header', () => ({ ScreenHeader: () => null }));
vi.mock('@/components/second-opinion/stylist-chooser-modal', () => ({ StylistChooserModal: () => null }));

const WeekPickerModalMock = vi.fn((_props: Record<string, unknown>) => null);
vi.mock('@/components/week/week-picker-modal', () => ({ WeekPickerModal: (props: unknown) => WeekPickerModalMock(props as Record<string, unknown>) }));

vi.mock('@/contexts/theme-context', () => ({ useTheme: () => ({ theme: { colors: { mutedText: '#000' } } }) }));
vi.mock('@/hooks/use-trendiness', () => ({ useTrendiness: () => 50 }));

const showToast = vi.fn();
vi.mock('@/components/ui/toast-provider', () => ({ useToast: () => ({ showToast }) }));

const getItems = vi.fn();
vi.mock('@/services/closet', () => ({ closetService: { getItems: (...args: unknown[]) => getItems(...args) } }));

const generateOutfits = vi.fn();
const getOutfitResult = vi.fn();
vi.mock('@/services/outfits', () => ({
  outfitsService: {
    generateOutfits: (...args: unknown[]) => generateOutfits(...args),
    getOutfitResult: (...args: unknown[]) => getOutfitResult(...args),
  },
}));

const saveSavedOutfit = vi.fn();
vi.mock('@/lib/saved-outfits-storage', () => ({
  buildSavedOutfitId: (requestId: string, tier: string, gen: number) => `${requestId}:${tier}:${gen}`,
  loadSavedOutfits: vi.fn().mockResolvedValue([]),
  saveSavedOutfit: (...args: unknown[]) => saveSavedOutfit(...args),
}));

const assignOutfitToWeekDay = vi.fn();
vi.mock('@/lib/week-plan-storage', () => ({ assignOutfitToWeekDay: (...args: unknown[]) => assignOutfitToWeekDay(...args) }));

const saveRecommendationFeedback = vi.fn();
vi.mock('@/lib/recommendation-feedback-storage', () => ({
  loadRecommendationFeedback: vi.fn().mockResolvedValue([]),
  saveRecommendationFeedback: (...args: unknown[]) => saveRecommendationFeedback(...args),
}));

vi.mock('@/lib/analytics', () => ({ trackSaveOutfit: vi.fn(), trackAddToWeek: vi.fn() }));

const recordError = vi.fn();
vi.mock('@/lib/crashlytics', () => ({ recordError: (...args: unknown[]) => recordError(...args), log: vi.fn() }));

// lib/closet-match (findBestClosetMatch) and lib/outfit-utils/lib/look-route
// (pure, no react-native import) are deliberately left real.

const { MultiLookResults } = await import('@/app/results/MultiLookResults');
const { findBestClosetMatch } = await import('@/lib/closet-match');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CLOSET_ITEMS: ClosetItem[] = [
  {
    id: 'closet-shirt-1', title: 'White oxford shirt', brand: 'Uniqlo', size: 'M', category: 'Shirt',
    uploadedImageUrl: null, sketchImageUrl: null, sketchStatus: 'ready', savedAt: '2026-01-01T00:00:00Z',
    colorFamily: 'white', formality: 'Smart Casual',
  },
  {
    id: 'closet-trousers-1', title: 'Navy chinos', brand: 'Bonobos', size: '32', category: 'Trousers',
    uploadedImageUrl: null, sketchImageUrl: null, sketchStatus: 'ready', savedAt: '2026-01-01T00:00:00Z',
    colorFamily: 'navy', formality: 'Smart Casual',
  },
  {
    id: 'closet-sneakers-1', title: 'White leather sneakers', brand: 'Common Projects', size: '10', category: 'Sneakers',
    uploadedImageUrl: null, sketchImageUrl: null, sketchStatus: 'ready', savedAt: '2026-01-01T00:00:00Z',
    colorFamily: 'white', formality: 'Casual',
  },
];

function piece(display_name: string, category: 'Shirt' | 'Trousers' | 'Sneakers', color: string): { display_name: string; metadata: { category: typeof category; color: string; formality: 'Smart Casual' } } {
  return { display_name, metadata: { category, color, formality: 'Smart Casual' } };
}

function makeRecommendation(requestId: string, overrides: Partial<GenerateOutfitsResponse['recommendations'][number]> = {}) {
  return {
    tier: 'casual' as const,
    title: `Look for ${requestId}`,
    anchorItem: 'chore jacket',
    keyPieces: [piece('Crisp white shirt', 'Shirt', 'white')],
    shoes: [piece('Clean white sneakers', 'Sneakers', 'white')],
    accessories: [],
    fitNotes: [],
    whyItWorks: 'It works.',
    stylingDirection: 'Keep it clean.',
    detailNotes: [],
    sketchStatus: 'ready' as const,
    sketchImageUrl: null,
    ...overrides,
  };
}

function makeResponse(requestId: string, overrides: Partial<GenerateOutfitsResponse['recommendations'][number]> = {}): GenerateOutfitsResponse {
  return {
    requestId,
    status: 'completed',
    generatedAt: '2026-01-01T00:00:00Z',
    input: BASE_INPUT,
    recommendations: [makeRecommendation(requestId, overrides)],
  };
}

const BASE_INPUT: CreateLookInput = {
  selectedTiers: ['casual'],
  anchorItemDescription: 'olive chore jacket',
  anchorItems: [{ id: 'anchor-primary', description: 'olive chore jacket', image: null, uploadedImage: null }],
} as unknown as CreateLookInput;

function renderScreen(variantRequestIds: string[] = []) {
  return render(
    <MultiLookResults
      primaryRequestId="req-primary"
      variantRequestIds={variantRequestIds}
      parsedInput={BASE_INPUT}
      addAnchorToCloset={false}
    />,
  );
}

async function lastCallFor(mock: ReturnType<typeof vi.fn>, requestId: string): Promise<Record<string, unknown>> {
  const calls = mock.mock.calls as [Record<string, unknown>][];
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const props = calls[i]![0];
    if ((props as { recommendation?: { title?: string } }).recommendation?.title === `Look for ${requestId}`) return props;
  }
  throw new Error(`no LookResultCard render captured for ${requestId}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  getItems.mockResolvedValue({ success: true, data: { items: CLOSET_ITEMS } });
  generateOutfits.mockImplementation(async (req: { requestId: string }) =>
    ({ success: true, data: makeResponse(req.requestId) }),
  );
  getOutfitResult.mockResolvedValue({ success: false, data: null });
  saveSavedOutfit.mockResolvedValue(undefined);
  assignOutfitToWeekDay.mockResolvedValue(undefined);
  saveRecommendationFeedback.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── 3. Match scoring ─────────────────────────────────────────────────────────

describe('MultiLookResults — closet match scoring', () => {
  it('A: closet items are loaded and used for matching', async () => {
    renderScreen();
    await waitFor(async () => {
      const props = await lastCallFor(LookResultCardMock, 'req-primary');
      expect(props.closetItems).toEqual(CLOSET_ITEMS);
    });
    const props = await lastCallFor(LookResultCardMock, 'req-primary');
    const matchMap = props.matchMap as Record<string, ClosetItem | null>;
    expect(matchMap['Crisp white shirt']?.id).toBe('closet-shirt-1');
    expect(matchMap['Clean white sneakers']?.id).toBe('closet-sneakers-1');
  });

  it('B: match map is request-specific — no slot receives another slot\'s match state', async () => {
    generateOutfits.mockImplementation(async (req: { requestId: string }) => {
      if (req.requestId === 'req-variant') {
        return { success: true, data: makeResponse('req-variant', { keyPieces: [piece('Navy chino trouser', 'Trousers', 'navy')], shoes: [] }) };
      }
      return { success: true, data: makeResponse(req.requestId) };
    });
    renderScreen(['req-variant']);

    await waitFor(async () => {
      await lastCallFor(LookResultCardMock, 'req-variant');
    });

    const primaryProps = await lastCallFor(LookResultCardMock, 'req-primary');
    const variantProps = await lastCallFor(LookResultCardMock, 'req-variant');
    const primaryMap = primaryProps.matchMap as Record<string, ClosetItem | null>;
    const variantMap = variantProps.matchMap as Record<string, ClosetItem | null>;

    expect(primaryMap['Crisp white shirt']?.id).toBe('closet-shirt-1');
    expect(variantMap['Crisp white shirt']).toBeUndefined();
    expect(variantMap['Navy chino trouser']?.id).toBe('closet-trousers-1');
    expect(primaryMap['Navy chino trouser']).toBeUndefined();
  });

  it('C: matches are produced by the exact same shared primitive used elsewhere in the app', async () => {
    renderScreen();
    const props = await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));
    const matchMap = props.matchMap as Record<string, ClosetItem | null>;

    const directMatch = findBestClosetMatch(piece('Crisp white shirt', 'Shirt', 'white'), CLOSET_ITEMS, undefined);
    expect(matchMap['Crisp white shirt']).toEqual(directMatch);
  });
});

// ── 4. Save ──────────────────────────────────────────────────────────────────

describe('MultiLookResults — save', () => {
  it('saves the correct slot with the correct requestId/payload, updates isSaved, and does not touch sibling slots', async () => {
    renderScreen(['req-variant']);
    await waitFor(() => lastCallFor(LookResultCardMock, 'req-variant'));

    const primaryProps = await lastCallFor(LookResultCardMock, 'req-primary');
    await act(async () => {
      (primaryProps.onSave as () => void)();
    });

    expect(saveSavedOutfit).toHaveBeenCalledTimes(1);
    const [input, recommendation, requestId, tierGeneration] = saveSavedOutfit.mock.calls[0]!;
    expect(requestId).toBe('req-primary');
    expect(tierGeneration).toBe(0);
    expect((recommendation as { title: string }).title).toBe('Look for req-primary');
    expect(input).toBe(BASE_INPUT);

    const updatedPrimary = await waitFor(async () => {
      const p = await lastCallFor(LookResultCardMock, 'req-primary');
      if (!p.isSaved) throw new Error('not yet saved');
      return p;
    });
    expect(updatedPrimary.isSaved).toBe(true);

    const variantProps = await lastCallFor(LookResultCardMock, 'req-variant');
    expect(variantProps.isSaved).toBe(false);
  });

  it('save failure shows an error toast, does not mark the slot saved, and clears the saving flag', async () => {
    saveSavedOutfit.mockRejectedValue(new Error('network down'));
    renderScreen();
    const props = await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));

    await act(async () => {
      (props.onSave as () => void)();
    });

    expect(showToast).toHaveBeenCalledWith('Could not save this outfit.', 'error');
    const after = await lastCallFor(LookResultCardMock, 'req-primary');
    expect(after.isSaved).toBe(false);
    expect(after.isSaving).toBe(false);
  });
});

// ── 5. Assign to week ────────────────────────────────────────────────────────

describe('MultiLookResults — assign to week', () => {
  it('assigns the correct requestId/day/payload and leaves sibling slots untouched', async () => {
    renderScreen(['req-variant']);
    await waitFor(() => lastCallFor(LookResultCardMock, 'req-variant'));

    const variantProps = await lastCallFor(LookResultCardMock, 'req-variant');
    act(() => {
      (variantProps.onAddToWeek as () => void)();
    });

    const modalProps = WeekPickerModalMock.mock.calls.at(-1)![0] as { onSelectDay: (d: string, l: string) => void; visible: boolean };
    expect(modalProps.visible).toBe(true);
    await act(async () => {
      modalProps.onSelectDay('tue', 'Tuesday');
    });

    expect(assignOutfitToWeekDay).toHaveBeenCalledTimes(1);
    const [dayKey, dayLabel, input, recommendation, requestId] = assignOutfitToWeekDay.mock.calls[0]!;
    expect(dayKey).toBe('tue');
    expect(dayLabel).toBe('Tuesday');
    expect(requestId).toBe('req-variant');
    expect((recommendation as { title: string }).title).toBe('Look for req-variant');
    expect(input).toBe(BASE_INPUT);
    expect(showToast).toHaveBeenCalledWith('Added to Tuesday.');
  });

  it('assign failure shows an error toast; the week-picker still closes either way (current behavior, not fixed here)', async () => {
    assignOutfitToWeekDay.mockRejectedValue(new Error('offline'));
    renderScreen();
    const props = await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));
    act(() => {
      (props.onAddToWeek as () => void)();
    });
    const modalProps = WeekPickerModalMock.mock.calls.at(-1)![0] as { onSelectDay: (d: string, l: string) => void };
    await act(async () => {
      modalProps.onSelectDay('wed', 'Wednesday');
    });

    expect(showToast).toHaveBeenCalledWith('Could not add this outfit to your week.', 'error');
    // Characterizes current behavior: setWeekPickerRequestId(null) runs
    // unconditionally after the try/catch, on both success and failure.
    const finalModalProps = WeekPickerModalMock.mock.calls.at(-1)![0] as { visible: boolean };
    expect(finalModalProps.visible).toBe(false);
  });
});

// ── 6. Outfit feedback ───────────────────────────────────────────────────────

describe('MultiLookResults — outfit feedback', () => {
  it('associates feedback with the correct request, sends the exact current payload shape, and does not affect sibling slots', async () => {
    renderScreen(['req-variant']);
    await waitFor(() => lastCallFor(LookResultCardMock, 'req-variant'));

    const primaryProps = await lastCallFor(LookResultCardMock, 'req-primary');
    await act(async () => {
      (primaryProps.onOutfitFeedback as (t: 'love' | 'hate') => void)('love');
    });

    expect(saveRecommendationFeedback).toHaveBeenCalledTimes(1);
    expect(saveRecommendationFeedback.mock.calls[0]![0]).toMatchObject({
      id: 'req-primary:casual:outfit',
      requestId: 'req-primary',
      tier: 'casual',
      outfitTitle: 'Look for req-primary',
      thumb: 'love',
      regenerated: false,
    });
    expect(showToast).toHaveBeenCalledWith('Noted — glad you love it.');

    const updatedPrimary = await waitFor(async () => {
      const p = await lastCallFor(LookResultCardMock, 'req-primary');
      if (p.outfitFeedback !== 'love') throw new Error('not yet updated');
      return p;
    });
    expect(updatedPrimary.outfitFeedback).toBe('love');

    const variantProps = await lastCallFor(LookResultCardMock, 'req-variant');
    expect(variantProps.outfitFeedback).toBeNull();
  });

  it('re-selecting the same thumb toggles feedback off locally WITHOUT calling saveRecommendationFeedback again (current behavior)', async () => {
    renderScreen();
    const props = await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));
    await act(async () => {
      (props.onOutfitFeedback as (t: 'love' | 'hate') => void)('love');
    });
    expect(saveRecommendationFeedback).toHaveBeenCalledTimes(1);

    const loved = await waitFor(async () => {
      const p = await lastCallFor(LookResultCardMock, 'req-primary');
      if (p.outfitFeedback !== 'love') throw new Error('not yet loved');
      return p;
    });
    await act(async () => {
      (loved.onOutfitFeedback as (t: 'love' | 'hate') => void)('love');
    });

    // Toggle-off is a pure local state change — no second save call, per
    // today's source (`if (feedbackMap[slot.requestId] === thumb) { ...; return; }`).
    expect(saveRecommendationFeedback).toHaveBeenCalledTimes(1);
    const toggled = await waitFor(async () => {
      const p = await lastCallFor(LookResultCardMock, 'req-primary');
      if (p.outfitFeedback !== null) throw new Error('not yet toggled off');
      return p;
    });
    expect(toggled.outfitFeedback).toBeNull();
  });

  // Phase R3A fix, regression coverage: brought into alignment with
  // useResultsActions.ts's handleOutfitFeedback — try/catch, recordError,
  // and a rollback of the optimistic local feedback state to whatever it
  // was before the failed attempt. Originally discovered as a gap in Phase
  // R2 (proven as a real unhandled rejection + no rollback); now proves the
  // corrected behavior instead of the bug.
  it('a failed feedback save is caught, recorded, and rolled back to the previous value — no unhandled rejection, sibling slots untouched', async () => {
    saveRecommendationFeedback.mockRejectedValue(new Error('offline'));
    renderScreen(['req-variant']);
    await waitFor(() => lastCallFor(LookResultCardMock, 'req-variant'));
    const props = await lastCallFor(LookResultCardMock, 'req-primary');

    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      await act(async () => {
        (props.onOutfitFeedback as (t: 'love' | 'hate') => void)('love');
        await Promise.resolve();
        await Promise.resolve();
      });
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }

    // Fixed: caught, no unhandled rejection.
    expect(unhandled).toHaveLength(0);

    // Fixed: recordError called with the same context string
    // useResultsActions.ts already uses for this exact scenario.
    expect(recordError).toHaveBeenCalledWith(expect.any(Error), 'outfit_feedback_save');
    expect((recordError.mock.calls[0]![0] as Error).message).toBe('offline');

    // Fixed: the optimistic 'love' selection is rolled back to its previous
    // value (null — there was no prior feedback for this slot).
    const after = await lastCallFor(LookResultCardMock, 'req-primary');
    expect(after.outfitFeedback).toBeNull();

    // Sibling slot is untouched by the primary slot's failed feedback.
    const variant = await lastCallFor(LookResultCardMock, 'req-variant');
    expect(variant.outfitFeedback).toBeNull();
  });

  it('rollback restores the PREVIOUS thumb (not just null) when switching from an existing selection fails', async () => {
    saveRecommendationFeedback.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    renderScreen();
    const props = await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));

    // First selection succeeds — 'love' is the established prior value.
    await act(async () => {
      (props.onOutfitFeedback as (t: 'love' | 'hate') => void)('love');
    });
    const loved = await waitFor(async () => {
      const p = await lastCallFor(LookResultCardMock, 'req-primary');
      if (p.outfitFeedback !== 'love') throw new Error('not yet loved');
      return p;
    });

    // Switching to 'hate' fails — must roll back to 'love', not to null.
    const onUnhandledRejection = () => undefined;
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      await act(async () => {
        (loved.onOutfitFeedback as (t: 'love' | 'hate') => void)('hate');
        await Promise.resolve();
        await Promise.resolve();
      });
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }

    const after = await lastCallFor(LookResultCardMock, 'req-primary');
    expect(after.outfitFeedback).toBe('love');
  });
});

// ── 7. Sketch polling — user-visible DATA behavior only ────────────────────
// (Section 8 below separately proves and TODO-flags the interval-recreation
// BUG this same polling effect has — that mechanism is NOT characterized as
// correct here.)

// @testing-library/react's waitFor relies on real setTimeout for its own
// retry loop, which hangs once vi.useFakeTimers() is active — so the
// polling tests below (which need fake timers active from BEFORE the
// initial generation settles; a real interval created before fake timers
// are installed is never observed by vi.advanceTimersByTimeAsync, confirmed
// by the first attempt at these tests) use vi.waitFor instead, which
// auto-advances fake timers while it polls.
async function untilPendingFake(requestId = 'req-primary') {
  return vi.waitFor(async () => {
    const p = await lastCallFor(LookResultCardMock, requestId);
    const rec = (p.recommendation as { sketchStatus?: string } | undefined);
    if (rec?.sketchStatus !== 'pending') throw new Error('not yet pending');
    return p;
  });
}

describe('MultiLookResults — sketch polling data behavior', () => {
  it('A: a pending sketch causes a poll request for that requestId', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen();
    await untilPendingFake();

    getOutfitResult.mockResolvedValue({ success: false, data: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(getOutfitResult).toHaveBeenCalledWith('req-primary');
  });

  it('B: a completed poll response updates that slot\'s sketch status/URL; sibling slots are unaffected', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen(['req-variant']);
    await untilPendingFake('req-primary');
    await untilPendingFake('req-variant');

    getOutfitResult.mockImplementation(async (requestId: string) => {
      if (requestId !== 'req-primary') return { success: false, data: null };
      return { success: true, data: makeResponse('req-primary', { sketchStatus: 'ready', sketchImageUrl: 'https://example.test/sketch.png' }) };
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    const primary = await lastCallFor(LookResultCardMock, 'req-primary');
    const primaryRec = primary.recommendation as { sketchStatus?: string; sketchImageUrl?: string | null };
    expect(primaryRec.sketchStatus).toBe('ready');
    expect(primaryRec.sketchImageUrl).toBe('https://example.test/sketch.png');

    // The variant slot never got a matching getOutfitResult response
    // (mocked to fail for any other requestId) — its own state must be
    // untouched by the poll tick that updated its sibling.
    const variant = await lastCallFor(LookResultCardMock, 'req-variant');
    expect((variant.recommendation as { sketchStatus?: string }).sketchStatus).toBe('pending');
  });

  it('C: multiple pending slots each receive their own returned sketch state, never a sibling\'s', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen(['req-variant']);
    await untilPendingFake('req-primary');
    await untilPendingFake('req-variant');

    getOutfitResult.mockImplementation(async (requestId: string) =>
      ({ success: true, data: makeResponse(requestId, { sketchStatus: 'ready', sketchImageUrl: `https://example.test/${requestId}.png` }) }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    const primary = await lastCallFor(LookResultCardMock, 'req-primary');
    const variant = await lastCallFor(LookResultCardMock, 'req-variant');
    expect((primary.recommendation as { sketchImageUrl?: string }).sketchImageUrl).toBe('https://example.test/req-primary.png');
    expect((variant.recommendation as { sketchImageUrl?: string }).sketchImageUrl).toBe('https://example.test/req-variant.png');
  });

  it('D: no pending sketches means no poll request is ever made', async () => {
    // Default beforeEach mock already resolves with sketchStatus 'ready'.
    renderScreen();
    await waitFor(() => lastCallFor(LookResultCardMock, 'req-primary'));

    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(getOutfitResult).not.toHaveBeenCalled();
  });

  it('E: polling stops after unmount — no further poll requests after the component is gone', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    const { unmount } = renderScreen();
    await untilPendingFake();

    getOutfitResult.mockResolvedValue({ success: false, data: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const callsBeforeUnmount = getOutfitResult.mock.calls.length;
    expect(callsBeforeUnmount).toBeGreaterThan(0);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(getOutfitResult.mock.calls.length).toBe(callsBeforeUnmount);
  });
});

// ── 8. Interval-recreation bug — reproduced, NOT locked in as correct ───────
//
// The audit found: the polling useEffect depends on [slots], and each tick's
// setSlots(...) call changes slots' identity, so the effect tears its
// interval down and recreates it after every single tick for as long as any
// slot is pending. This test PROVES that churn exists today — it does not
// assert it as desired behavior. Per this phase's instructions, the fix
// belongs to Phase R3; this test is a TODO regression marker for the
// invariant that fix must satisfy.
describe('MultiLookResults — interval lifecycle (Phase R3A fix, regression coverage)', () => {
  it('a polling tick with unchanged pending state does not restart the interval', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen();
    await untilPendingFake();

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    // Still pending after the tick — slots' object identity still changes
    // (setSlots always produces a fresh array), but the LOGICAL pending set
    // (which requestIds are pending) is unchanged.
    getOutfitResult.mockResolvedValue({ success: true, data: makeResponse('req-primary', { sketchStatus: 'pending' }) });

    const setIntervalCallsBefore = setIntervalSpy.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // Fixed: the polling effect now depends on a pendingSignature string
    // (which requestIds are pending), not on `slots` itself — a tick that
    // leaves the pending set unchanged no longer tears down and recreates
    // the interval.
    expect(setIntervalSpy.mock.calls.length).toBe(setIntervalCallsBefore);
  });

  it('pending transitioning to none stops polling (no further poll requests after the last pending slot completes)', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen();
    await untilPendingFake();

    getOutfitResult.mockResolvedValue({ success: true, data: makeResponse('req-primary', { sketchStatus: 'ready' }) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const callsAfterCompletion = getOutfitResult.mock.calls.length;
    expect(callsAfterCompletion).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    // No pending slots remain — polling must not continue.
    expect(getOutfitResult.mock.calls.length).toBe(callsAfterCompletion);
  });
});

// ── 9. Reentrancy gap — reproduced, NOT locked in as correct ────────────────
//
// useResultsPolling.ts has an isPollingRef reentrancy guard; this inline
// poller has none. This proves whether a second poll tick can start before
// the first tick's request for the same requestId has resolved.
describe('MultiLookResults — reentrancy guard (Phase R3A fix, regression coverage)', () => {
  it('a second poll tick does not start a new request while the previous one is still in flight, and the guard releases once it resolves', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen();
    await untilPendingFake();

    let resolveFirst: ((v: { success: boolean; data: GenerateOutfitsResponse | null }) => void) | null = null;
    const firstCallGate = new Promise<{ success: boolean; data: GenerateOutfitsResponse | null }>((resolve) => {
      resolveFirst = resolve;
    });
    let callCount = 0;
    getOutfitResult.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) return firstCallGate;
      return { success: true, data: makeResponse('req-primary', { sketchStatus: 'pending' }) };
    });

    // First tick fires and blocks on the unresolved gate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(callCount).toBe(1);

    // A second tick fires before the first request has resolved.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // Fixed: isPollingRef blocks the second tick from starting a new
    // request while the first is still in flight.
    expect(callCount).toBe(1);

    // Resolve the first request — the guard must release (in `finally`),
    // so the NEXT tick can poll normally.
    resolveFirst!({ success: true, data: makeResponse('req-primary', { sketchStatus: 'pending' }) });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(callCount).toBe(2);
  });

  it('the guard also releases after a FAILED poll — a failed request does not permanently disable future polling', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen();
    await untilPendingFake();

    let callCount = 0;
    getOutfitResult.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('first tick network error');
      return { success: true, data: makeResponse('req-primary', { sketchStatus: 'ready' }) };
    });

    // First tick fires and rejects.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(callCount).toBe(1);

    // A second tick must still be able to poll — the guard was released in
    // `finally` despite the first request failing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(callCount).toBe(2);

    const primary = await lastCallFor(LookResultCardMock, 'req-primary');
    expect((primary.recommendation as { sketchStatus?: string }).sketchStatus).toBe('ready');
  });
});

// ── 10. Polling error-handling gap ──────────────────────────────────────────
//
// useResultsPolling.ts wraps its poll in try/catch + recordError; this
// inline poller does not. This characterizes exactly what happens today
// when the poll request rejects — not what SHOULD happen.
describe('MultiLookResults — polling error handling (Phase R3A fix, regression coverage)', () => {
  it('a rejected poll request is caught and recorded, produces no unhandled rejection, does not corrupt sibling slot state, and polling continues on the next tick', async () => {
    vi.useFakeTimers();
    generateOutfits.mockImplementation(async (req: { requestId: string }) =>
      ({ success: true, data: makeResponse(req.requestId, { sketchStatus: 'pending' }) }),
    );
    renderScreen(['req-variant']);
    await untilPendingFake('req-primary');
    await untilPendingFake('req-variant');

    let primaryCallCount = 0;
    getOutfitResult.mockImplementation(async (requestId: string) => {
      if (requestId === 'req-primary') {
        primaryCallCount += 1;
        if (primaryCallCount === 1) throw new Error('network down');
        return { success: true, data: makeResponse('req-primary', { sketchStatus: 'ready' }) };
      }
      return { success: true, data: makeResponse('req-variant', { sketchStatus: 'ready', sketchImageUrl: 'https://example.test/variant.png' }) };
    });

    // Fixed: the poll tick's try/catch now catches this rejection — proven
    // directly (not just inferred from the test not crashing) by asserting
    // no unhandledRejection event fires, matching how the original bug was
    // proven in R2.
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
        await Promise.resolve();
      });
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
    expect(unhandled).toHaveLength(0);

    // Phase R3B: polling is now the SAME shared useResultsPolling hook the
    // single-response screen uses, so the recordError context string is
    // that hook's own 'results_polling_tick_failed' — no longer a
    // MultiLookResults-specific label, by design (this is exactly what
    // consolidating onto one shared implementation means).
    expect(recordError).toHaveBeenCalledWith(expect.any(Error), 'results_polling_tick_failed');
    expect((recordError.mock.calls[0]![0] as Error).message).toBe('network down');

    // Sibling slot state is untouched by the failure.
    const variant = await lastCallFor(LookResultCardMock, 'req-variant');
    expect((variant.recommendation as { sketchStatus?: string }).sketchStatus).toBe('ready');
    const primaryAfterFailure = await lastCallFor(LookResultCardMock, 'req-primary');
    expect((primaryAfterFailure.recommendation as { sketchStatus?: string }).sketchStatus).toBe('pending');

    // Polling continues after the failure — the next tick successfully
    // updates the primary slot too.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const primaryAfterRecovery = await lastCallFor(LookResultCardMock, 'req-primary');
    expect((primaryAfterRecovery.recommendation as { sketchStatus?: string }).sketchStatus).toBe('ready');
  });
});
