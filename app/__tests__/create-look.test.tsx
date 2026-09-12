// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CreateLookInput } from '@/types/look-request';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// Terminology/cross-link change: the "Build From My Closet" modal now links
// into this screen ("Build Around a Piece") with a `closetOnly=true` route
// param, so that flow's own "Pair only items from my closet" mode is already
// on — keeping the link's "entirely from your closet" promise true. This
// file proves the route param is correctly threaded into the form's
// initialValue.closetOnly, and that the pre-existing closet-item entry path
// (Anchor to Outfit / Help Me Pick — closetItemId params, no closetOnly) is
// unaffected.

let mockParams: Record<string, string | undefined> = {};

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
vi.mock('@/lib/analytics', () => ({ trackCreateLookStarted: vi.fn() }));
vi.mock('@/components/ui/app-screen', () => ({ AppScreen: (props: { children?: unknown }) => <div>{props.children as any}</div> }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/components/ui/screen-header', () => ({ ScreenHeader: () => null }));

let capturedInitialValue: CreateLookInput | null = null;
vi.mock('@/components/forms/create-look-request-form', () => ({
  CreateLookRequestForm: (props: { initialValue: CreateLookInput }) => {
    capturedInitialValue = props.initialValue;
    return <div data-testid="create-look-form" />;
  },
}));

const CreateLookScreen = (await import('@/app/create-look')).default;

beforeEach(() => {
  mockParams = {};
  capturedInitialValue = null;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('create-look screen — closetOnly cross-link param', () => {
  it('defaults closetOnly to false on normal entry (no params)', () => {
    render(<CreateLookScreen />);
    expect(capturedInitialValue?.closetOnly).toBe(false);
  });

  it('sets closetOnly=true when the Build From My Closet cross-link param is present', () => {
    mockParams = { closetOnly: 'true', fresh: '123' };
    render(<CreateLookScreen />);
    expect(capturedInitialValue?.closetOnly).toBe(true);
  });

  it('the pre-existing closet-item entry path (Anchor to Outfit / Help Me Pick) is unaffected — closetOnly stays false and the item still pre-fills', () => {
    mockParams = {
      closetItemId: 'item-1',
      closetItemTitle: 'Navy Blazer',
      closetItemImageUrl: 'https://example.com/blazer.jpg',
      closetItemFitStatus: 'fits-well',
    };
    render(<CreateLookScreen />);
    expect(capturedInitialValue?.closetOnly).toBe(false);
    expect(capturedInitialValue?.anchorItems).toHaveLength(1);
    expect(capturedInitialValue?.anchorItems[0]?.description).toBe('Navy Blazer');
  });

  it('an unset/garbage closetOnly param value is treated as false, not truthy-by-presence', () => {
    mockParams = { closetOnly: 'false' };
    render(<CreateLookScreen />);
    expect(capturedInitialValue?.closetOnly).toBe(false);
  });
});
