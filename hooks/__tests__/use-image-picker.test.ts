// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A representative loading-state-recovery test: pickFromLibrary is shared
// across 7 screens (anchor items, closet fit-check, selfie review, check-
// piece, haircut planner, and both closet-save flows) and exercises all
// three outcomes a real async operation can have: success, a resolved
// "failure" that never throws (permission denied), and an actual thrown
// rejection (fixed earlier this session — previously left isPicking stuck).

const { requestMediaLibraryPermissionsAsyncMock, launchImageLibraryAsyncMock, manipulateAsyncMock } = vi.hoisted(() => ({
  requestMediaLibraryPermissionsAsyncMock: vi.fn(),
  launchImageLibraryAsyncMock: vi.fn(),
  manipulateAsyncMock: vi.fn(),
}));

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: requestMediaLibraryPermissionsAsyncMock,
  launchImageLibraryAsync: launchImageLibraryAsyncMock,
}));

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: manipulateAsyncMock,
  SaveFormat: { JPEG: 'jpeg' },
}));

vi.mock('react-native', () => ({
  Keyboard: { dismiss: vi.fn() },
}));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({ recordError: recordErrorMock, log: vi.fn() }));

const { useImagePicker } = await import('@/hooks/use-image-picker');

const PICKED_ASSET = { uri: 'file://picked.jpg', width: 800, height: 600, fileName: 'picked.jpg', mimeType: 'image/jpeg' };

beforeEach(() => {
  vi.clearAllMocks();
  manipulateAsyncMock.mockResolvedValue({ uri: 'file://compressed.jpg', width: 800, height: 600 });
});

describe('useImagePicker.pickFromLibrary — the three outcomes a pick can have', () => {
  it('SUCCESS: sets the image, clears any error, and isPicking always settles back to false', async () => {
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: true });
    launchImageLibraryAsyncMock.mockResolvedValue({ canceled: false, assets: [PICKED_ASSET] });

    const { result } = renderHook(() => useImagePicker());

    let picked!: unknown;
    await act(async () => { picked = await result.current.pickFromLibrary(); });

    expect(picked).not.toBeNull();
    expect(result.current.image?.uri).toBe('file://compressed.jpg');
    expect(result.current.error).toBeNull();
    expect(result.current.isPicking).toBe(false);
  });

  it('RESOLVED FAILURE (permission denied — never throws): sets a user-visible error, isPicking still settles, image stays untouched', async () => {
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: false });

    const { result } = renderHook(() => useImagePicker());

    let picked!: unknown;
    await act(async () => { picked = await result.current.pickFromLibrary(); });

    expect(picked).toBeNull();
    expect(result.current.image).toBeNull();
    expect(result.current.error).toBe('Photo library access is required to choose an image.');
    expect(result.current.isPicking).toBe(false);
    expect(launchImageLibraryAsyncMock).not.toHaveBeenCalled();
  });

  it('REJECTED (an actual thrown error): logs it, sets a user-visible error, and isPicking still settles — the bug this session\'s fix closed', async () => {
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: true });
    launchImageLibraryAsyncMock.mockRejectedValue(new Error('picker crashed'));

    const { result } = renderHook(() => useImagePicker());

    let picked!: unknown;
    await act(async () => { picked = await result.current.pickFromLibrary(); });

    expect(picked).toBeNull();
    expect(result.current.error).toBe('picker crashed');
    expect(result.current.isPicking).toBe(false); // never gets stuck true
    expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), 'image_picker_pick_from_library');
  });

  it('retry after a failure succeeds cleanly — the error state does not linger', async () => {
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValue({ granted: true });
    launchImageLibraryAsyncMock.mockRejectedValueOnce(new Error('transient failure'));
    launchImageLibraryAsyncMock.mockResolvedValueOnce({ canceled: false, assets: [PICKED_ASSET] });

    const { result } = renderHook(() => useImagePicker());

    await act(async () => { await result.current.pickFromLibrary(); });
    expect(result.current.error).toBe('transient failure');

    await act(async () => { await result.current.pickFromLibrary(); });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.image?.uri).toBe('file://compressed.jpg');
    expect(result.current.isPicking).toBe(false);
  });
});
