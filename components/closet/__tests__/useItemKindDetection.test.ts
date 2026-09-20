// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Type-aware Add Closet Item routing: auto-detection must never override an
// explicit manual choice, and must only auto-switch above the confidence
// threshold — otherwise the garment path (the default) stays untouched and
// the user corrects manually. See useItemKindDetection.ts's own header.

const classifyItemKind = vi.fn();
vi.mock('@/services/closet', () => ({ closetService: { classifyItemKind } }));

const { useItemKindDetection } = await import('@/components/closet/useItemKindDetection');

function fakeUploadedImage(id = 'img-1') {
  return { id, publicUrl: `https://example.com/${id}.jpg` } as any;
}

beforeEach(() => {
  classifyItemKind.mockReset();
});

describe('useItemKindDetection', () => {
  it('defaults to the given initialItemKind', () => {
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));
    expect(result.current.itemKind).toBe('garment');
  });

  it('auto-switches to fragrance on a confident detection', async () => {
    classifyItemKind.mockResolvedValue({ success: true, data: { itemKind: 'fragrance', confidence: 0.85 }, error: null });
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage());
    });

    expect(result.current.itemKind).toBe('fragrance');
    expect(result.current.detected?.confidence).toBe(0.85);
  });

  it('does NOT auto-switch below the confidence threshold — leaves the mode as-is for manual correction', async () => {
    classifyItemKind.mockResolvedValue({ success: true, data: { itemKind: 'fragrance', confidence: 0.4 }, error: null });
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage());
    });

    expect(result.current.itemKind).toBe('garment');
    // Still surfaces the low-confidence guess so the UI can offer a correction affordance.
    expect(result.current.detected?.kind).toBe('fragrance');
  });

  it('never auto-switches once the user has manually set a kind, even on a later confident detection', async () => {
    classifyItemKind.mockResolvedValue({ success: true, data: { itemKind: 'fragrance', confidence: 0.99 }, error: null });
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    act(() => {
      result.current.setItemKind('garment'); // explicit manual choice
    });

    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage());
    });

    expect(result.current.itemKind).toBe('garment');
  });

  it('setItemKind lets the user switch to fragrance manually regardless of detection state', () => {
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    act(() => {
      result.current.setItemKind('fragrance');
    });

    expect(result.current.itemKind).toBe('fragrance');
  });

  it('ignores an "unknown" classification — leaves the mode and detected guess untouched', async () => {
    classifyItemKind.mockResolvedValue({ success: true, data: { itemKind: 'unknown', confidence: 0.5 }, error: null });
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage());
    });

    expect(result.current.itemKind).toBe('garment');
    expect(result.current.detected).toBeNull();
  });

  it('reset() clears detection state and restores the given kind', async () => {
    classifyItemKind.mockResolvedValue({ success: true, data: { itemKind: 'fragrance', confidence: 0.9 }, error: null });
    const { result } = renderHook(() => useItemKindDetection({ initialItemKind: 'garment' }));

    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage());
    });
    expect(result.current.itemKind).toBe('fragrance');

    act(() => {
      result.current.reset('garment');
    });

    expect(result.current.itemKind).toBe('garment');
    expect(result.current.detected).toBeNull();

    // Confirms the manual-override flag was cleared too — a subsequent
    // confident detection can auto-switch again after reset.
    await act(async () => {
      await result.current.detectFromImage(fakeUploadedImage('img-2'));
    });
    expect(result.current.itemKind).toBe('fragrance');
  });
});
