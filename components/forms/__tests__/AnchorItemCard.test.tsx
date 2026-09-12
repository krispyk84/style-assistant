// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { LookAnchorItem } from '@/types/look-request';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Terminology change: the per-card badge shown for each "starting piece" in
// the Build Around a Piece form used to read "Primary Anchor" / "Anchor
// Item" — now "Starting Piece" / "Additional Piece". This is a pure copy
// change; the component, its file name, its exported name, and its internal
// prop/hook names (AnchorItemCard, useUploadedImage('anchor-item', ...),
// onToggleSaveToCloset, etc.) are deliberately left untouched, per the
// terminology task's "don't mechanically rename internal concepts" rule —
// the last test below is a lightweight guard that those identifiers still
// exist under their original names.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Pressable: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={props.onPress}>{props.children as any}</button>
  ),
  TextInput: (props: { value?: string }) => <input value={props.value} readOnly />,
}));
vi.mock('expo-image', () => ({ Image: () => null }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/hooks/use-uploaded-image', () => ({
  useUploadedImage: () => ({
    image: null,
    uploadedImage: null,
    isPickingLibrary: false,
    isPickingCamera: false,
    isUploading: false,
    uploadProgress: 0,
    error: null,
    uploadSuccessMessage: null,
    pickFromLibrary: vi.fn(),
    takePhoto: vi.fn(),
    removeImage: vi.fn(),
  }),
}));

const { AnchorItemCard } = await import('@/components/forms/AnchorItemCard');

function fakeItem(): LookAnchorItem {
  return { id: 'item-1', description: '', image: null, uploadedImage: null };
}

function textOf(container: HTMLElement) {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  cleanup();
});

describe('AnchorItemCard — badge terminology', () => {
  it('the primary (first) card reads "Starting Piece", not "Primary Anchor"', () => {
    const { container } = render(
      <AnchorItemCard item={fakeItem()} isPrimary removable={false} onChange={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(textOf(container)).toContain('Starting Piece');
    expect(textOf(container)).not.toContain('Primary Anchor');
    expect(textOf(container)).not.toContain('Anchor');
  });

  it('a non-primary (additional) card reads "Additional Piece", not "Anchor Item"', () => {
    const { container } = render(
      <AnchorItemCard item={fakeItem()} isPrimary={false} removable onChange={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(textOf(container)).toContain('Additional Piece');
    expect(textOf(container)).not.toContain('Anchor Item');
    expect(textOf(container)).not.toContain('Anchor');
  });

  it('the save-to-closet toggle reads "Save this piece to my closet"', () => {
    const { container } = render(
      <AnchorItemCard
        item={fakeItem()}
        isPrimary
        removable={false}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        showSaveToCloset
        onToggleSaveToCloset={vi.fn()}
      />,
    );
    expect(textOf(container)).toContain('Save this piece to my closet');
    expect(textOf(container)).not.toContain('Save anchor item');
  });
});

describe('AnchorItemCard — internal identifiers deliberately unchanged', () => {
  it('the component keeps its original name and prop shape (not renamed away from "Anchor")', () => {
    // A rename-safety check, not a UI check: this task explicitly forbids
    // mechanically renaming internal concepts (component names, hook
    // categories, route/type names) just to chase the new user-facing copy.
    expect(AnchorItemCard.name).toBe('AnchorItemCard');
  });
});
