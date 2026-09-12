// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LabeledPiece } from '@/lib/outfit-piece-display';
import type { ClosetItem } from '@/types/closet';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Feature: color swatches beside each suggested item name in "The Look"
// (display='labeled' mode only — see OutfitPieceListView.tsx's LabeledList).
// Same react-native mocking convention as LookResultCardView.test.tsx.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown; style?: any; testID?: string }) => (
    <div data-testid={props.testID} data-style={JSON.stringify(props.style)}>{props.children as any}</div>
  ),
  Pressable: (props: { children?: unknown; onPress?: () => void; accessibilityLabel?: string }) => (
    <button aria-label={props.accessibilityLabel} onClick={props.onPress}>{props.children as any}</button>
  ),
  ActivityIndicator: () => <div data-testid="activity-indicator" />,
}));

vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => <div data-testid="check-icon" /> }));
vi.mock('@/components/closet/closet-item-sheet', () => ({ ClosetItemSheet: () => null }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: { colors: { accent: '#a00', border: '#ccc', mutedText: '#666' } } }),
}));

const { OutfitPieceListView } = await import('@/components/cards/OutfitPieceListView');

function piece(overrides: Partial<LabeledPiece>): LabeledPiece {
  return {
    label: 'Top',
    value: 'White Heavyweight Cotton Crewneck T-Shirt',
    matchedClosetItem: null,
    confidencePercent: 0,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('OutfitPieceListView — color swatches (display="labeled")', () => {
  it('an item with valid color metadata renders a swatch resolved to the expected display color', () => {
    const { container } = render(
      <OutfitPieceListView display="labeled" pieces={[piece({ colorName: 'Navy' })]} />,
    );
    const swatch = container.querySelector('[data-style*="1B2848"]'); // ANCHOR_COLOR_HEX navy
    expect(swatch).not.toBeNull();
  });

  it('a light/white color still renders a visible swatch with the same border treatment as any other color', () => {
    const { container } = render(
      <OutfitPieceListView display="labeled" pieces={[piece({ colorName: 'White' })]} />,
    );
    const swatch = container.querySelector('[data-style*="F5F5F5"]');
    expect(swatch).not.toBeNull();
    const style = JSON.parse(swatch!.getAttribute('data-style')!);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe('#ccc');
  });

  it('the swatch belongs to the item-name row, not the category label row — the label text has no adjacent colored square', () => {
    const { container } = render(
      <OutfitPieceListView display="labeled" pieces={[piece({ label: 'Top', colorName: 'Navy' })]} />,
    );
    // Exactly one swatch-shaped (16x16, borderRadius 4) element exists for one piece.
    const swatches = Array.from(container.querySelectorAll('[data-style]')).filter((el) => {
      try {
        const s = JSON.parse(el.getAttribute('data-style') || '{}');
        return s.width === 16 && s.height === 16 && s.borderRadius === 4;
      } catch {
        return false;
      }
    });
    expect(swatches).toHaveLength(1);
    expect(screen.getByText('Top')).toBeTruthy();
    expect(screen.getByText('White Heavyweight Cotton Crewneck T-Shirt')).toBeTruthy();
  });

  it('ownership checkmark behavior is unaffected by color swatches — still renders for a matched item, independent of color', () => {
    const matchedItem = { id: 'item-1', title: 'White Tee' } as unknown as ClosetItem;
    render(
      <OutfitPieceListView
        display="labeled"
        pieces={[piece({ colorName: 'White', matchedClosetItem: matchedItem, confidencePercent: 90 })]}
      />,
    );
    // Two check icons are expected here — the shared "you already own..."
    // hint banner AND the per-piece ownership button — both pre-existing,
    // unaffected by the swatch feature.
    expect(screen.getAllByTestId('check-icon').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('You already own a similar piece')).toBeTruthy();
    expect(screen.getByLabelText('You own a similar piece: White Tee. Tap to view and rate.')).toBeTruthy();
  });

  it('a missing/unrecognized color does not crash and displays no swatch', () => {
    const { container } = render(
      <OutfitPieceListView display="labeled" pieces={[piece({ colorName: undefined })]} />,
    );
    const swatches = Array.from(container.querySelectorAll('[data-style]')).filter((el) => {
      try {
        const s = JSON.parse(el.getAttribute('data-style') || '{}');
        return s.width === 16 && s.height === 16;
      } catch {
        return false;
      }
    });
    expect(swatches).toHaveLength(0);
    expect(screen.getByText('White Heavyweight Cotton Crewneck T-Shirt')).toBeTruthy();
  });

  it('an unrecognized color WORD (not in the mapping) also omits the swatch rather than guessing', () => {
    const { container } = render(
      <OutfitPieceListView display="labeled" pieces={[piece({ colorName: 'Glimmering Aurora' })]} />,
    );
    const swatches = Array.from(container.querySelectorAll('[data-style]')).filter((el) => {
      try {
        const s = JSON.parse(el.getAttribute('data-style') || '{}');
        return s.width === 16 && s.height === 16;
      } catch {
        return false;
      }
    });
    expect(swatches).toHaveLength(0);
  });

  it('different pieces/cards display their own correct colors, not a shared or leaked color', () => {
    const { container } = render(
      <OutfitPieceListView
        display="labeled"
        pieces={[
          piece({ label: 'Top', value: 'Navy sweater', colorName: 'Navy' }),
          piece({ label: 'Shoes', value: 'Black sneakers', colorName: 'Black' }),
        ]}
      />,
    );
    expect(container.querySelector('[data-style*="1B2848"]')).not.toBeNull(); // navy
    expect(container.querySelector('[data-style*="1C1C1C"]')).not.toBeNull(); // black
  });

  it('a long, wrapping item name still renders correctly alongside its swatch', () => {
    const longName = 'A very long suggested item name that is expected to wrap across more than one line of text in the card';
    render(
      <OutfitPieceListView display="labeled" pieces={[piece({ value: longName, colorName: 'Navy' })]} />,
    );
    expect(screen.getByText(longName)).toBeTruthy();
  });
});
