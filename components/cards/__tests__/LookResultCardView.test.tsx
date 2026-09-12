// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LookRecommendation } from '@/types/look-request';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Feature: outfit-card UX (Save outfit / Add to week moved out of the
// collapsible ACTIONS section, always visible below the sketch). Mirrors
// MultiLookResults.characterization.test.tsx's established pattern for this
// codebase: react-native itself can't be imported under vitest/rolldown
// (Flow syntax), so it's mocked at the module boundary with real DOM
// semantics (Pressable -> a real <button>, clickable via fireEvent) rather
// than the pass-through-only mock MultiLookResults' test uses, since this
// file specifically needs to prove onPress wiring, not just prop shapes.
// OutfitActionsAccordion is left REAL (not mocked) so this file can prove
// Save/Add-to-week render OUTSIDE it and stay visible while it's collapsed.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
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

vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/generated/GeneratedSketchPanel', () => ({ GeneratedSketchPanel: () => <div data-testid="sketch-panel" /> }));
vi.mock('@/components/cards/OutfitFrameworkView', () => ({ OutfitFrameworkView: () => null }));
vi.mock('@/components/closet/closet-item-sheet', () => ({ ClosetItemSheet: () => null }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        accent: '#000', border: '#ccc', inverseText: '#fff', mutedText: '#666',
        subtleSurface: '#eee', surface: '#fff', text: '#000',
      },
    },
  }),
}));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('@/lib/outfit-chat-flow', () => ({ outfitChatFlow: { setPendingContext: vi.fn() } }));

const { LookResultCardView } = await import('@/components/cards/LookResultCardView');

function fakeRecommendation(overrides: Partial<LookRecommendation> = {}): LookRecommendation {
  return {
    tier: 'smart-casual',
    title: 'Weekend Look',
    anchorItem: 'White Sneakers',
    keyPieces: [],
    shoes: [],
    accessories: [],
    fitNotes: [],
    whyItWorks: 'It works.',
    stylingDirection: '',
    detailNotes: [],
    sketchStatus: 'ready',
    sketchImageUrl: 'https://example.com/sketch.jpg',
    ...overrides,
  } as unknown as LookRecommendation;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('LookResultCardView — Save outfit / Add to week always-visible placement', () => {
  it('Save outfit is visible while ACTIONS is collapsed (the accordion\'s default state)', () => {
    render(
      <LookResultCardView
        recommendation={fakeRecommendation()}
        detailHref="/results/req-1"
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Save outfit')).toBeTruthy();
  });

  it('Add to week is visible while ACTIONS is collapsed', () => {
    render(
      <LookResultCardView
        recommendation={fakeRecommendation()}
        detailHref="/results/req-1"
        onAddToWeek={vi.fn()}
      />,
    );
    expect(screen.getByText('Add to week')).toBeTruthy();
  });

  it('Save outfit and Add to week are NOT inside the collapsible ACTIONS content — Selfie Check (an ACTIONS-only item) is not visible until expanded, while Save/Add already are', () => {
    render(
      <LookResultCardView
        recommendation={fakeRecommendation()}
        detailHref="/results/req-1"
        onSave={vi.fn()}
        onAddToWeek={vi.fn()}
      />,
    );
    // ACTIONS starts collapsed — Selfie Check (moved nowhere, still inside) is not rendered yet.
    expect(screen.queryByText('Selfie Check')).toBeNull();
    // Save/Add to week are unaffected by that collapsed state.
    expect(screen.getByText('Save outfit')).toBeTruthy();
    expect(screen.getByText('Add to week')).toBeTruthy();
  });

  it('toggling ACTIONS open does not hide or duplicate the Save/Add row, and reveals only the secondary tools', () => {
    render(
      <LookResultCardView
        recommendation={fakeRecommendation()}
        detailHref="/results/req-1"
        onSave={vi.fn()}
        onAddToWeek={vi.fn()}
        onSecondOpinion={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Expand actions'));

    expect(screen.getAllByText('Save outfit')).toHaveLength(1); // not duplicated inside ACTIONS
    expect(screen.getAllByText('Add to week')).toHaveLength(1);
    expect(screen.getByText('Selfie Check')).toBeTruthy();
    expect(screen.getByText('Second Opinion')).toBeTruthy();
    expect(screen.getByText('Ask Questions')).toBeTruthy();
  });

  it('Save outfit still invokes the existing onSave handler with no arguments (unchanged payload/behavior)', () => {
    const onSave = vi.fn();
    render(
      <LookResultCardView recommendation={fakeRecommendation()} detailHref="/results/req-1" onSave={onSave} />,
    );
    fireEvent.click(screen.getByText('Save outfit'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('Add to week still invokes the existing onAddToWeek handler unchanged', () => {
    const onAddToWeek = vi.fn();
    render(
      <LookResultCardView recommendation={fakeRecommendation()} detailHref="/results/req-1" onAddToWeek={onAddToWeek} />,
    );
    fireEvent.click(screen.getByText('Add to week'));
    expect(onAddToWeek).toHaveBeenCalledTimes(1);
  });

  it('Save outfit reflects saved/saving state exactly as before (disabled + label change)', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <LookResultCardView recommendation={fakeRecommendation()} detailHref="/results/req-1" onSave={onSave} isSaved />,
    );
    expect(screen.getByText('Saved')).toBeTruthy();
    fireEvent.click(screen.getByText('Saved'));
    expect(onSave).not.toHaveBeenCalled(); // disabled once saved

    rerender(
      <LookResultCardView recommendation={fakeRecommendation()} detailHref="/results/req-1" onSave={onSave} isSaving />,
    );
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('multi-card isolation: two cards for two different recommendations each invoke their OWN onSave/onAddToWeek', () => {
    const onSaveA = vi.fn();
    const onSaveB = vi.fn();
    const onAddToWeekA = vi.fn();
    const onAddToWeekB = vi.fn();

    render(
      <>
        <LookResultCardView
          recommendation={fakeRecommendation({ title: 'Look A' })}
          detailHref="/results/req-a"
          onSave={onSaveA}
          onAddToWeek={onAddToWeekA}
        />
        <LookResultCardView
          recommendation={fakeRecommendation({ title: 'Look B' })}
          detailHref="/results/req-b"
          onSave={onSaveB}
          onAddToWeek={onAddToWeekB}
        />
      </>,
    );

    const saveButtons = screen.getAllByText('Save outfit');
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
