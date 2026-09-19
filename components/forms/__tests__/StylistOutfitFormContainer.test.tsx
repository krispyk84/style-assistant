// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// This is the core of the generation request model (sections 14/18 of the
// Ask a Stylist spec): proves inline validation, that exactly 3 looks are
// requested via the same variantRequestIds mechanism the original multi-look
// flow already uses, that anchor ids/brief/stylistId/closetOnly all reach
// the actual navigation params (buildSubmitRouteParams runs for REAL here,
// not mocked — that's what proves the request model, not a description of
// it), tier-inference failure handling, and duplicate-submission prevention.
//
// useAnchorItemsForm/useStylistOutfitForm are mocked at module scope so this
// file can drive StylistOutfitFormContainer's OWN submit/validation/
// navigation logic directly, without needing to interact with the real
// anchor-picker/mic UI (covered by their own component test files) just to
// get a populated fixture state.

const pushMock = vi.fn();
// Captures the callback the component registers via useFocusEffect without
// auto-invoking it (a real useEffect-based mock would fire on every mount,
// resetting isSubmitting before the duplicate-submission/error-state tests
// below get to observe it). The dedicated "regains focus" test below invokes
// the captured callback directly to simulate expo-router calling it when
// this screen becomes focused again — the actual trigger for the bug this
// hook fixes (see StylistOutfitFormContainer.tsx).
const { useFocusEffectMock } = vi.hoisted(() => ({ useFocusEffectMock: vi.fn() }));
vi.mock('expo-router', () => ({
  router: { push: pushMock },
  useFocusEffect: useFocusEffectMock,
}));

vi.mock('@/lib/weather-storage', () => ({ loadWeatherContext: vi.fn().mockResolvedValue(null) }));

const { inferStylistTierMock } = vi.hoisted(() => ({ inferStylistTierMock: vi.fn() }));
vi.mock('@/services/outfits', () => ({ outfitsService: { inferStylistTier: inferStylistTierMock } }));

vi.mock('@/components/forms/StylistOutfitFormView', () => ({
  StylistOutfitFormView: (props: { onGenerate: () => void; submitError: string | null; isSubmitting: boolean }) => (
    <div>
      <button onClick={props.onGenerate}>Generate</button>
      <div>{props.isSubmitting ? 'submitting' : 'idle'}</div>
      {props.submitError ? <div>{props.submitError}</div> : null}
    </div>
  ),
}));

const { anchorFormMock } = vi.hoisted(() => ({
  anchorFormMock: vi.fn(() => ({
    populatedAnchorItems: [{ id: 'a1', description: 'navy blazer', image: null, uploadedImage: null }],
    shouldAddAnchorToCloset: false,
    anchorError: null as string | null,
    setAnchorError: vi.fn(),
  })),
}));
vi.mock('@/components/forms/useAnchorItemsForm', () => ({ useAnchorItemsForm: anchorFormMock }));

const { stylistFormMock } = vi.hoisted(() => ({
  stylistFormMock: vi.fn(() => ({
    stylistId: 'alessandra' as 'vittorio' | 'alessandra' | null,
    stylistBrief: 'Dinner downtown, keep it current.',
    closetOnly: false,
    stylistError: null as string | null,
    briefError: null as string | null,
    setStylistError: vi.fn(),
    setBriefError: vi.fn(),
  })),
}));
vi.mock('@/components/forms/useStylistOutfitForm', () => ({ useStylistOutfitForm: stylistFormMock }));

const { StylistOutfitForm } = await import('@/components/forms/StylistOutfitFormContainer');

beforeEach(() => {
  vi.clearAllMocks();
  anchorFormMock.mockReturnValue({
    populatedAnchorItems: [{ id: 'a1', description: 'navy blazer', image: null, uploadedImage: null }],
    shouldAddAnchorToCloset: false,
    anchorError: null,
    setAnchorError: vi.fn(),
  });
  stylistFormMock.mockReturnValue({
    stylistId: 'alessandra',
    stylistBrief: 'Dinner downtown, keep it current.',
    closetOnly: false,
    stylistError: null,
    briefError: null,
    setStylistError: vi.fn(),
    setBriefError: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

describe('StylistOutfitFormContainer — validation', () => {
  it('blocks submission and reports an anchor error when no pieces are selected', () => {
    const setAnchorError = vi.fn();
    anchorFormMock.mockReturnValue({ populatedAnchorItems: [], shouldAddAnchorToCloset: false, anchorError: null, setAnchorError });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));

    expect(setAnchorError).toHaveBeenCalledWith('Add an image, a description, or both before continuing.');
    expect(inferStylistTierMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('blocks submission and reports a stylist error when no stylist is selected', () => {
    const setStylistError = vi.fn();
    stylistFormMock.mockReturnValue({
      stylistId: null, stylistBrief: 'Dinner downtown.', closetOnly: false,
      stylistError: null, briefError: null, setStylistError, setBriefError: vi.fn(),
    });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));

    expect(setStylistError).toHaveBeenCalledWith('Choose a stylist to continue.');
    expect(inferStylistTierMock).not.toHaveBeenCalled();
  });

  it('blocks submission and reports a brief error when the brief is empty', () => {
    const setBriefError = vi.fn();
    stylistFormMock.mockReturnValue({
      stylistId: 'vittorio', stylistBrief: '   ', closetOnly: false,
      stylistError: null, briefError: null, setStylistError: vi.fn(), setBriefError,
    });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));

    expect(setBriefError).toHaveBeenCalledWith('Tell your stylist what you need before generating.');
    expect(inferStylistTierMock).not.toHaveBeenCalled();
  });
});

describe('StylistOutfitFormContainer — generation request', () => {
  it('requests exactly 3 looks, preserving anchor ids, the brief, the stylist, and closetOnly', async () => {
    inferStylistTierMock.mockResolvedValue({ success: true, data: { tier: 'smart-casual' }, error: null });
    stylistFormMock.mockReturnValue({
      stylistId: 'alessandra', stylistBrief: 'Dinner downtown, keep it current.', closetOnly: true,
      stylistError: null, briefError: null, setStylistError: vi.fn(), setBriefError: vi.fn(),
    });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    expect(inferStylistTierMock).toHaveBeenCalledWith('Dinner downtown, keep it current.');

    const call = pushMock.mock.calls[0]![0];
    expect(call.pathname).toBe('/results/[requestId]');
    const params = call.params;

    expect(params.stylistId).toBe('alessandra');
    expect(params.tiers).toBe('smart-casual');
    expect(params.additionalDetails).toBe('Dinner downtown, keep it current.');
    expect(params.closetOnly).toBe('true');
    // 3 looks total = the primary requestId + 2 variant ids.
    expect(params.lookCount).toBe('3');
    expect(params.variantRequestIds.split(',')).toHaveLength(2);

    const anchorItems = JSON.parse(params.anchorItems);
    expect(anchorItems).toHaveLength(1);
    expect(anchorItems[0].description).toBe('navy blazer');
  });

  it('surfaces an error and does not navigate when tier inference fails', async () => {
    inferStylistTierMock.mockResolvedValue({ success: false, data: null, error: { code: 'X', message: 'Could not understand the brief.' } });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));
    await screen.findByText('Could not understand the brief.');

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('prevents a duplicate submission while a request is already in progress', async () => {
    let resolveTier!: (v: unknown) => void;
    inferStylistTierMock.mockReturnValue(new Promise((resolve) => { resolveTier = resolve; }));

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));
    fireEvent.click(screen.getByText('Generate'));
    fireEvent.click(screen.getByText('Generate'));

    resolveTier({ success: true, data: { tier: 'casual' }, error: null });
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    expect(inferStylistTierMock).toHaveBeenCalledTimes(1);
  });
});

// ── S3 fix: back-navigation from results left the form stuck mid-submission ─
//
// A successful submit deliberately never resets isSubmitting (it expected
// the screen to unmount on navigation — see the comment in
// StylistOutfitFormContainer.tsx). But expo-router's stack keeps this screen
// instance mounted, so navigating back re-focuses that same stuck state:
// a permanently disabled "Generating..." button with no way to submit again
// without leaving and re-entering the flow. Caught via physical-device
// testing, not the deterministic suite — this test locks in the fix.
describe('StylistOutfitFormContainer — regains focus after a successful submit', () => {
  it('resets isSubmitting and submitError so the form is usable again on back-navigation', async () => {
    inferStylistTierMock.mockResolvedValue({ success: true, data: { tier: 'smart-casual' }, error: null });

    render(<StylistOutfitForm />);
    fireEvent.click(screen.getByText('Generate'));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    // Mirrors the screenshot: still mounted, still stuck submitting, exactly
    // as if the user just navigated back from results.
    expect(screen.getByText('submitting')).toBeTruthy();

    const registeredFocusCallback = useFocusEffectMock.mock.calls.at(-1)![0] as () => void;
    act(() => {
      registeredFocusCallback();
    });

    expect(screen.getByText('idle')).toBeTruthy();
  });
});
