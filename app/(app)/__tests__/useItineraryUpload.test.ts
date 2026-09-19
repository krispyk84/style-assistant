// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── What this file is ───────────────────────────────────────────────────────
//
// Upload for the trip planner's "Have an itinerary?" affordance (Plans
// step): proves the pick→upload→extract flow, that a canceled file picker
// is a silent no-op, that a genuine failure surfaces via `error` (never
// blocking manual trip planning), and that a zero-overlap result (server
// read the PDF fine, nothing matched this trip's dates/destination) is kept
// separate from `error` as `noOverlapMessage` — an informational note, not
// a failure state.

const getDocumentAsyncMock = vi.fn();
vi.mock('expo-document-picker', () => ({ getDocumentAsync: getDocumentAsyncMock }));

const extractItineraryMock = vi.fn();
vi.mock('@/services/trip-itinerary', () => ({ tripItineraryService: { extractItinerary: extractItineraryMock } }));

const { useItineraryUpload } = await import('@/app/(app)/useItineraryUpload');

const PARAMS = { destination: 'Paris, France', departureDate: '2026-09-23', returnDate: '2026-09-27' };

beforeEach(() => {
  getDocumentAsyncMock.mockReset();
  extractItineraryMock.mockReset();
});

describe('useItineraryUpload', () => {
  it('does nothing when the user cancels the file picker', async () => {
    getDocumentAsyncMock.mockResolvedValue({ canceled: true, assets: null });
    const onExtracted = vi.fn();

    const { result } = renderHook(() => useItineraryUpload());
    await act(async () => { await result.current.pickAndExtract({ ...PARAMS, onExtracted }); });

    expect(extractItineraryMock).not.toHaveBeenCalled();
    expect(onExtracted).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('uploads the picked PDF and hands the extracted days to onExtracted', async () => {
    getDocumentAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'itinerary.pdf', uri: 'file://itinerary.pdf', mimeType: 'application/pdf' }],
    });
    extractItineraryMock.mockResolvedValue({
      success: true,
      data: { days: [{ date: '2026-09-24', summary: 'Conference all day' }], excludedCount: 2 },
      error: null,
    });
    const onExtracted = vi.fn();

    const { result } = renderHook(() => useItineraryUpload());
    await act(async () => { await result.current.pickAndExtract({ ...PARAMS, onExtracted }); });

    expect(extractItineraryMock).toHaveBeenCalledTimes(1);
    const call = extractItineraryMock.mock.calls[0]![0];
    expect(call.file).toEqual({ uri: 'file://itinerary.pdf', fileName: 'itinerary.pdf', mimeType: 'application/pdf' });
    expect(call.destination).toBe(PARAMS.destination);

    expect(onExtracted).toHaveBeenCalledWith([{ date: '2026-09-24', summary: 'Conference all day' }]);
    expect(result.current.excludedCount).toBe(2);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failure via error and never calls onExtracted', async () => {
    getDocumentAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'itinerary.pdf', uri: 'file://itinerary.pdf', mimeType: 'application/pdf' }],
    });
    extractItineraryMock.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'PDF_NO_TEXT', message: 'Could not find any text in this PDF.' },
    });
    const onExtracted = vi.fn();

    const { result } = renderHook(() => useItineraryUpload());
    await act(async () => { await result.current.pickAndExtract({ ...PARAMS, onExtracted }); });

    expect(onExtracted).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Could not find any text in this PDF.');
    expect(result.current.noOverlapMessage).toBeNull();
  });

  it('surfaces a zero-overlap result as noOverlapMessage, not error, and does not call onExtracted', async () => {
    getDocumentAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'itinerary.pdf', uri: 'file://itinerary.pdf', mimeType: 'application/pdf' }],
    });
    extractItineraryMock.mockResolvedValue({
      success: true,
      data: { days: [], excludedCount: 5 },
      error: null,
    });
    const onExtracted = vi.fn();

    const { result } = renderHook(() => useItineraryUpload());
    await act(async () => { await result.current.pickAndExtract({ ...PARAMS, onExtracted }); });

    expect(onExtracted).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.noOverlapMessage).toBeTruthy();
  });

  it('clearError resets the error state', async () => {
    getDocumentAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ name: 'itinerary.pdf', uri: 'file://itinerary.pdf', mimeType: 'application/pdf' }],
    });
    extractItineraryMock.mockResolvedValue({ success: false, data: null, error: { code: 'X', message: 'Failed.' } });

    const { result } = renderHook(() => useItineraryUpload());
    await act(async () => { await result.current.pickAndExtract({ ...PARAMS, onExtracted: vi.fn() }); });
    expect(result.current.error).toBe('Failed.');

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });
});
