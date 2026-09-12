// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClosetGeneratedOutfit } from '@/types/api';
import type { ClosetItem } from '@/types/closet';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Feature: closet-made outfit card cleanup (Save outfit / Add to week moved
// out of the collapsible ACTIONS section to always-visible directly below
// the sketch, and the verbose slot/framework list removed — thumbnails are
// now the sole piece representation). Mirrors LookResultCardView.test.tsx's
// established pattern for this codebase: react-native is mocked at the
// module boundary with real DOM semantics (Pressable -> a real <button>)
// rather than a pass-through-only mock, since this file needs to prove
// onPress wiring (Save/Add/thumbnail-selection/hat/bag), not just prop
// shapes. OutfitActionsAccordion and OutfitItemThumbnailRow are left REAL so
// this file can prove Save/Add render outside the accordion and that
// thumbnail tap-to-select still drives Generate Variants.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Text: (props: { children?: unknown }) => <span>{props.children as any}</span>,
  Pressable: (props: { children?: unknown; onPress?: () => void; disabled?: boolean; accessibilityLabel?: string }) => (
    <button
      aria-label={props.accessibilityLabel}
      onClick={props.disabled ? undefined : props.onPress}
      disabled={props.disabled}>
      {props.children as any}
    </button>
  ),
  ActivityIndicator: () => <div data-testid="activity-indicator" />,
}));

vi.mock('expo-image', () => ({ Image: () => <div data-testid="thumbnail-image" /> }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/generated/GeneratedSketchPanel', () => ({ GeneratedSketchPanel: () => <div data-testid="sketch-panel" /> }));
vi.mock('@/components/cards/closet-outfit-detail-modal', () => ({ ClosetOutfitDetailModal: () => null }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        accent: '#000', border: '#ccc', danger: '#c00', inverseText: '#fff', mutedText: '#666',
        subtleSurface: '#eee', subtleText: '#999', surface: '#fff', text: '#000', card: '#f5f5f5',
      },
      fonts: { sansMedium: 'System' },
    },
  }),
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@/lib/outfit-chat-flow', () => ({ outfitChatFlow: { setPendingContext: vi.fn() } }));

const { ClosetOutfitCard } = await import('@/components/cards/closet-outfit-card');

function fakeItem(overrides: Partial<ClosetItem> = {}): ClosetItem {
  return {
    id: 'item-1',
    title: 'Tan Suede Retro Sneakers',
    category: 'Footwear',
    sketchImageUrl: 'https://example.com/sneakers.jpg',
    ...overrides,
  } as unknown as ClosetItem;
}

function fakeOutfit(overrides: Partial<ClosetGeneratedOutfit> = {}): ClosetGeneratedOutfit {
  return {
    id: 'outfit-1',
    title: 'Weekend Closet Look',
    whyItWorks: 'It works.',
    items: [
      fakeItem({ id: 'shoe-1', title: 'Tan Suede Retro Sneakers', category: 'Footwear' }),
      fakeItem({ id: 'bottom-1', title: 'Tobacco Lightweight Easy Trousers', category: 'Bottoms' }),
      fakeItem({ id: 'top-1', title: 'Forti Jacquard Terry Cotton Camp Shirt', category: 'Tops' }),
    ],
    framework: {
      frameworkLabel: 'Casual',
      slots: [
        { label: 'Footwear', items: [{ title: 'Tan Suede Retro Sneakers', closetItemId: 'shoe-1' }] },
        { label: 'Bottoms', items: [{ title: 'Tobacco Lightweight Easy Trousers', closetItemId: 'bottom-1' }] },
        { label: 'Primary Top', items: [{ title: 'Forti Jacquard Terry Cotton Camp Shirt', closetItemId: 'top-1' }] },
        { label: 'Secondary Top', items: [] },
        { label: 'Thermal Layer', items: [] },
        { label: 'Outerwear', items: [] },
      ],
    },
    feedbackId: 'fb-1',
    feedback: null,
    sketchJobId: 'job-1',
    sketchStatus: 'ready',
    sketchImageUrl: 'https://example.com/sketch.jpg',
    ...overrides,
  } as unknown as ClosetGeneratedOutfit;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ClosetOutfitCard — Save / Add to week always-visible placement', () => {
  it('Save is visible without expanding ACTIONS', () => {
    render(<ClosetOutfitCard outfit={fakeOutfit()} onSave={vi.fn()} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('Add to week is visible without expanding ACTIONS', () => {
    render(<ClosetOutfitCard outfit={fakeOutfit()} onAddToWeek={vi.fn()} />);
    expect(screen.getByText('Add to week')).toBeTruthy();
  });

  it('expanding ACTIONS does not hide Save/Add and does not duplicate them; reveals only secondary tools', () => {
    render(
      <ClosetOutfitCard
        outfit={fakeOutfit()}
        onSave={vi.fn()}
        onAddToWeek={vi.fn()}
        onSecondOpinion={vi.fn()}
      />,
    );
    // Collapsed: Second Opinion (ACTIONS-only) not yet visible, Save/Add already are.
    expect(screen.queryByText('Second Opinion')).toBeNull();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Add to week')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Expand actions'));

    expect(screen.getAllByText('Save')).toHaveLength(1); // not duplicated inside ACTIONS
    expect(screen.getAllByText('Add to week')).toHaveLength(1);
    expect(screen.getByText('Second Opinion')).toBeTruthy();
    expect(screen.getByText('Ask Questions')).toBeTruthy();
  });

  it('Save still invokes the existing onSave handler unchanged', () => {
    const onSave = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('Add to week still invokes the existing onAddToWeek handler unchanged', () => {
    const onAddToWeek = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onAddToWeek={onAddToWeek} />);
    fireEvent.click(screen.getByText('Add to week'));
    expect(onAddToWeek).toHaveBeenCalledTimes(1);
  });

  it('Save reflects saved/saving state exactly as before (disabled + label change)', () => {
    const onSave = vi.fn();
    const { rerender } = render(<ClosetOutfitCard outfit={fakeOutfit()} onSave={onSave} isSaved />);
    expect(screen.getByText('Saved')).toBeTruthy();
    fireEvent.click(screen.getByText('Saved'));
    expect(onSave).not.toHaveBeenCalled();

    rerender(<ClosetOutfitCard outfit={fakeOutfit()} onSave={onSave} isSaving />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('favourites/delete mode (onDelete only, no onSave/onAddToWeek) shows no Save/Add row, and Remove lives inside ACTIONS', () => {
    const onDelete = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onDelete={onDelete} />);
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Add to week')).toBeNull();
    expect(screen.queryByText('Remove')).toBeNull(); // collapsed

    fireEvent.click(screen.getByLabelText('Expand actions'));
    expect(screen.getByText('Remove')).toBeTruthy();
    fireEvent.click(screen.getByText('Remove'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('multi-card isolation: two cards each invoke their OWN onSave/onAddToWeek', () => {
    const onSaveA = vi.fn();
    const onSaveB = vi.fn();
    const onAddToWeekA = vi.fn();
    const onAddToWeekB = vi.fn();

    render(
      <>
        <ClosetOutfitCard outfit={fakeOutfit({ id: 'a', title: 'Look A' })} onSave={onSaveA} onAddToWeek={onAddToWeekA} />
        <ClosetOutfitCard outfit={fakeOutfit({ id: 'b', title: 'Look B' })} onSave={onSaveB} onAddToWeek={onAddToWeekB} />
      </>,
    );

    const saveButtons = screen.getAllByText('Save');
    const addButtons = screen.getAllByText('Add to week');
    expect(saveButtons).toHaveLength(2);
    expect(addButtons).toHaveLength(2);

    fireEvent.click(saveButtons[0]!);
    expect(onSaveA).toHaveBeenCalledTimes(1);
    expect(onSaveB).not.toHaveBeenCalled();

    fireEvent.click(addButtons[1]!);
    expect(onAddToWeekB).toHaveBeenCalledTimes(1);
    expect(onAddToWeekA).not.toHaveBeenCalled();
  });
});

describe('ClosetOutfitCard — piece presentation', () => {
  it('THE PIECES thumbnail section still renders with each owned item', () => {
    render(<ClosetOutfitCard outfit={fakeOutfit()} />);
    expect(screen.getByText('The Pieces')).toBeTruthy();
    expect(screen.getByText('Tan Suede Retro Sneakers')).toBeTruthy();
    expect(screen.getByText('Tobacco Lightweight Easy Trousers')).toBeTruthy();
    expect(screen.getByText('Forti Jacquard Terry Cotton Camp Shirt')).toBeTruthy();
  });

  it('the detailed framework/slot list no longer renders for this card', () => {
    render(<ClosetOutfitCard outfit={fakeOutfit()} />);
    expect(screen.queryByText(/Casual Framework/i)).toBeNull();
    expect(screen.queryByText('Secondary Top')).toBeNull();
    expect(screen.queryByText('Thermal Layer')).toBeNull();
    // "Footwear" no longer appears as a slot-list row label (thumbnails use item titles, not slot labels, when no `label` is passed).
    expect(screen.queryByText('Footwear')).toBeNull();
  });

  it('removing the list does not alter the underlying outfit data passed in (framework still present on the object)', () => {
    const outfit = fakeOutfit();
    render(<ClosetOutfitCard outfit={outfit} />);
    expect(outfit.framework.slots).toHaveLength(6);
    expect(outfit.framework.frameworkLabel).toBe('Casual');
  });
});

describe('ClosetOutfitCard — variant selection', () => {
  it('tapping thumbnails selects up to 2 pieces and Generate Variants receives exactly those item ids', () => {
    const onGenerateVariants = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onGenerateVariants={onGenerateVariants} />);

    fireEvent.click(screen.getByText('Tan Suede Retro Sneakers'));
    fireEvent.click(screen.getByText('Tobacco Lightweight Easy Trousers'));

    fireEvent.click(screen.getByText('Generate Variants'));
    expect(onGenerateVariants).toHaveBeenCalledWith(['shoe-1', 'bottom-1']);
  });

  it('a 3rd tap is ignored once 2 pieces are already selected (MAX_SWAP_SELECTION)', () => {
    const onGenerateVariants = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onGenerateVariants={onGenerateVariants} />);

    fireEvent.click(screen.getByText('Tan Suede Retro Sneakers'));
    fireEvent.click(screen.getByText('Tobacco Lightweight Easy Trousers'));
    fireEvent.click(screen.getByText('Forti Jacquard Terry Cotton Camp Shirt'));

    fireEvent.click(screen.getByText('Generate Variants'));
    expect(onGenerateVariants).toHaveBeenCalledWith(['shoe-1', 'bottom-1']);
  });

  it('tapping a selected thumbnail again deselects it', () => {
    const onGenerateVariants = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onGenerateVariants={onGenerateVariants} />);

    fireEvent.click(screen.getByText('Tan Suede Retro Sneakers'));
    fireEvent.click(screen.getByText('Tan Suede Retro Sneakers'));

    fireEvent.click(screen.getByText('Generate Variants')); // still disabled: 0 selected
    expect(onGenerateVariants).not.toHaveBeenCalled();
  });

  it('Generate Variants button is disabled until at least 1 piece is selected', () => {
    const onGenerateVariants = vi.fn();
    render(<ClosetOutfitCard outfit={fakeOutfit()} onGenerateVariants={onGenerateVariants} />);
    fireEvent.click(screen.getByText('Generate Variants'));
    expect(onGenerateVariants).not.toHaveBeenCalled();
  });

  it('thumbnails are not selectable when onGenerateVariants is not provided (view-only card)', () => {
    render(<ClosetOutfitCard outfit={fakeOutfit()} />);
    expect(screen.queryByText('Generate Variants')).toBeNull();
    // Thumbnails render as plain (non-button) content, not selection targets.
    expect(screen.getByText('Tan Suede Retro Sneakers')).toBeTruthy();
  });
});

describe('ClosetOutfitCard — Add hat / Add bag regression', () => {
  it('Add hat and Add bag remain functional and independent of Save/Add-to-week/variants', () => {
    const onToggleHat = vi.fn();
    const onToggleBag = vi.fn();
    render(
      <ClosetOutfitCard
        outfit={fakeOutfit()}
        onSave={vi.fn()}
        onGenerateVariants={vi.fn()}
        onToggleHat={onToggleHat}
        onToggleBag={onToggleBag}
      />,
    );

    fireEvent.click(screen.getByText('Add hat'));
    expect(onToggleHat).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Add bag'));
    expect(onToggleBag).toHaveBeenCalledTimes(1);
  });

  it('shows "Hat added" / "Bag added" once the outfit already includes them', () => {
    const outfit = fakeOutfit({
      items: [
        fakeItem({ id: 'hat-1', title: 'Wool Fedora', category: 'Hat' }),
        fakeItem({ id: 'bag-1', title: 'Canvas Tote', category: 'Bag' }),
      ],
    });
    render(<ClosetOutfitCard outfit={outfit} onToggleHat={vi.fn()} onToggleBag={vi.fn()} />);
    expect(screen.getByText('Hat added')).toBeTruthy();
    expect(screen.getByText('Bag added')).toBeTruthy();
  });
});
