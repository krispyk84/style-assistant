// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';

const { uploadImageMock, deleteUploadMock } = vi.hoisted(() => ({
  uploadImageMock: vi.fn(),
  deleteUploadMock: vi.fn(),
}));

vi.mock('@/services/uploads', () => ({
  uploadsService: { uploadImage: uploadImageMock, deleteUpload: deleteUploadMock },
}));

// use-image-picker is a sibling hook with its own picker/permission logic —
// mocked out entirely so this file stays focused on useUploadedImage's own
// upload-orchestration behavior (the version-token fix), not the picker's.
vi.mock('@/hooks/use-image-picker', () => ({
  useImagePicker: () => ({
    image: null,
    isPicking: false,
    isPickingLibrary: false,
    isPickingCamera: false,
    error: null,
    pickFromLibrary: vi.fn(),
    pickMultipleFromLibrary: vi.fn(),
    takePhoto: vi.fn(),
    removeImage: vi.fn(),
    setImage: vi.fn(),
  }),
}));

const { useUploadedImage } = await import('@/hooks/use-uploaded-image');

function fakeLocalImage(uri: string): LocalImageAsset {
  return { uri, width: 100, height: 100, fileName: null, mimeType: 'image/jpeg' };
}

function fakeUploaded(id: string): UploadedImageAsset {
  return { id, publicUrl: `https://example.test/${id}.jpg` } as unknown as UploadedImageAsset;
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteUploadMock.mockResolvedValue({ success: true, data: null });
});

describe('useUploadedImage — a stale (slower) upload cannot overwrite a newer (faster) one', () => {
  it('request A begins, request B begins after, B finishes first, A finishes late: A is discarded', async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    uploadImageMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));

    const { result } = renderHook(() => useUploadedImage('anchor-item'));

    // Request A begins (e.g. the user picked a photo)...
    let uploadA!: Promise<void>;
    act(() => {
      uploadA = result.current.uploadImage(fakeLocalImage('photo-a.jpg'));
    });

    // ...then, before A resolves, request B begins (e.g. the picker button
    // wasn't disabled and the user tapped it again with a different photo).
    let uploadB!: Promise<void>;
    act(() => {
      uploadB = result.current.uploadImage(fakeLocalImage('photo-b.jpg'));
    });

    expect(uploadImageMock).toHaveBeenCalledTimes(2);

    // B (the newer request) finishes first.
    await act(async () => {
      resolveB({ success: true, data: fakeUploaded('upload-b') });
      await uploadB;
    });
    expect(result.current.uploadedImage?.id).toBe('upload-b');

    // A (the older, stale request) finishes late — its result must be discarded.
    await act(async () => {
      resolveA({ success: true, data: fakeUploaded('upload-a') });
      await uploadA;
    });

    // B's result must still be what's showing — A did not clobber it.
    expect(result.current.uploadedImage?.id).toBe('upload-b');
    expect(result.current.isUploading).toBe(false);
  });

  it('a stale request that FAILS after a newer one already SUCCEEDED does not surface a stale error or spinner', async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    uploadImageMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));

    const { result } = renderHook(() => useUploadedImage('anchor-item'));

    let uploadA!: Promise<void>;
    act(() => { uploadA = result.current.uploadImage(fakeLocalImage('photo-a.jpg')); });
    let uploadB!: Promise<void>;
    act(() => { uploadB = result.current.uploadImage(fakeLocalImage('photo-b.jpg')); });

    await act(async () => {
      resolveB({ success: true, data: fakeUploaded('upload-b') });
      await uploadB;
    });
    expect(result.current.uploadedImage?.id).toBe('upload-b');
    expect(result.current.isUploading).toBe(false);

    // The stale A request fails late — must not overwrite B's success with an
    // error, and must not flip isUploading back on with nothing to clear it.
    await act(async () => {
      resolveA({ success: false, error: { message: 'A failed' } });
      await uploadA;
    });

    expect(result.current.uploadedImage?.id).toBe('upload-b');
    expect(result.current.error).toBeNull();
    expect(result.current.isUploading).toBe(false);
  });

  it('a single upload with no overlap still works normally (no regression from the token guard)', async () => {
    uploadImageMock.mockResolvedValue({ success: true, data: fakeUploaded('upload-solo') });

    const { result } = renderHook(() => useUploadedImage('anchor-item'));

    await act(async () => {
      await result.current.uploadImage(fakeLocalImage('photo.jpg'));
    });

    await waitFor(() => expect(result.current.uploadedImage?.id).toBe('upload-solo'));
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadSuccessMessage).toBe('Upload complete.');
  });
});
