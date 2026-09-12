// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Terminology change: the two home entry cards are the canonical user-facing
// names for Vesture's two outfit-generation flows — "Build Around a Piece"
// (the anchor flow) and "Build From My Closet" (the closet-only / Generate 5
// Outfits flow). HeroCardContent/GenerateFromClosetButton were split out of
// HomeScreen.tsx into components/cards/HomeCards.tsx specifically so this
// file can render the exact same card-content components production uses
// without also pulling in HomeScreen's `require('../../logo.png')`-style
// static asset imports and carousel/splash-overlay data-loading machinery,
// none of which survive a bare vitest/jsdom environment. This file (and
// HomeCards.tsx itself) must live under components/, not app/(app)/ — any
// .tsx file directly inside app/(app)/ is auto-registered as a tab route by
// Expo Router unless explicitly hidden in _layout.tsx, and a pure
// presentational component has no reason to be a route at all.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Pressable: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={props.onPress}>{props.children as any}</button>
  ),
  StyleSheet: { absoluteFillObject: {} },
}));
vi.mock('expo-image', () => ({ Image: () => <div data-testid="carousel-image" /> }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/contexts/theme-context', () => ({ useTheme: () => ({ theme: { colors: {}, fonts: { sansMedium: 'System' } } }) }));
vi.mock('@/components/closet/ClosetReadinessTracker', async () => {
  const actual = await vi.importActual<typeof import('@/components/closet/ClosetReadinessTracker')>(
    '@/components/closet/ClosetReadinessTracker',
  );
  return { ClosetReadinessTracker: () => null, joinWithAnd: actual.joinWithAnd };
});

const { HeroCardContent, GenerateFromClosetButton } = await import('@/components/cards/HomeCards');

function textOf(container: HTMLElement) {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  cleanup();
});

describe('Home — Build Around a Piece card (top hero)', () => {
  it('renders the canonical "Build Around a Piece" headline', () => {
    const { container } = render(<HeroCardContent accentColor="#000" inverseColor="#fff" />);
    expect(textOf(container)).toContain('Build Around a Piece');
  });

  it('renders the preferred supporting copy', () => {
    render(<HeroCardContent accentColor="#000" inverseColor="#fff" />);
    expect(screen.getByText('Start with something you own and create complete looks around it.')).toBeTruthy();
  });

  it('no longer renders the old "Create a New Look" headline', () => {
    const { container } = render(<HeroCardContent accentColor="#000" inverseColor="#fff" />);
    expect(textOf(container)).not.toContain('Create a New Look');
  });
});

describe('Home — Build From My Closet card (bottom, ready state)', () => {
  const readyProps = {
    readiness: {
      ready: true as const,
      itemCount: 20,
      missing: [],
      progress: {
        total: { have: 20, need: 15 },
        tops: { have: 6, need: 4 },
        bottoms: { have: 4, need: 2 },
        footwear: { have: 3, need: 2 },
      },
    },
    onPress: vi.fn(),
    currentImageUrl: null,
    isResolved: false,
    accentColor: '#000',
    inverseColor: '#fff',
  };

  it('renders the canonical "Build From My Closet" headline', () => {
    const { container } = render(<GenerateFromClosetButton {...readyProps} />);
    expect(textOf(container)).toContain('Build From My Closet');
  });

  it('renders the preferred supporting copy', () => {
    render(<GenerateFromClosetButton {...readyProps} />);
    expect(screen.getByText('Create complete looks entirely from pieces you already own.')).toBeTruthy();
  });

  it('no longer renders the old "Create Outfits From My Closet" headline', () => {
    const { container } = render(<GenerateFromClosetButton {...readyProps} />);
    expect(textOf(container)).not.toContain('Create Outfits From My Closet');
  });

  it('contains no stray "anchor" terminology', () => {
    const { container } = render(<GenerateFromClosetButton {...readyProps} />);
    expect(textOf(container).toLowerCase()).not.toContain('anchor');
  });
});

describe('Home — Build From My Closet card (not-ready state references the other flow by its new name)', () => {
  const notReadyProps = {
    readiness: {
      ready: false as const,
      itemCount: 8,
      missing: ['2 more tops', '1 more bottom'],
      progress: {
        total: { have: 8, need: 15 },
        tops: { have: 2, need: 4 },
        bottoms: { have: 1, need: 2 },
        footwear: { have: 2, need: 2 },
      },
    },
    onPress: vi.fn(),
    currentImageUrl: null,
    isResolved: false,
    accentColor: '#000',
    inverseColor: '#fff',
  };

  it('names the flow "Build From My Closet" in the not-ready heading', () => {
    const { container } = render(<GenerateFromClosetButton {...notReadyProps} />);
    expect(textOf(container)).toContain('Build From My Closet needs a wider variety first');
  });

  it('references the other flow as "Build Around a Piece", not the old name', () => {
    const { container } = render(<GenerateFromClosetButton {...notReadyProps} />);
    expect(textOf(container)).toContain('Unlike Build Around a Piece above');
    expect(textOf(container)).not.toContain('Create a New Look');
  });
});
