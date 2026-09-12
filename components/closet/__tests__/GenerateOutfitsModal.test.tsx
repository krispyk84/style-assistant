// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// ── Why this file exists ─────────────────────────────────────────────────────
//
// New cross-link: the "Build From My Closet" modal's Additional Details
// section now offers an inline "Build Around a Piece" link that (1) closes
// this modal cleanly and (2) navigates into /create-look with
// closetOnly=true, so that flow's own closet-only mode is already on —
// keeping the link copy's "entirely from your closet" promise true. This
// file protects that behavior plus the pre-existing "Generate" button, which
// must remain unaffected by the new link.

const pushMock = vi.fn();

// RN's Pressable/Text onPress is a non-bubbling gesture-responder callback —
// nesting a real DOM <button>/<span onClick> reintroduces DOM event bubbling
// that has no RN equivalent (a tap inside the nested "Generate" button would
// otherwise also fire the modal's outer backdrop Pressable's onPress here).
// stopPropagation on every mock keeps the simulated tree's behavior faithful
// to RN's actual (non-bubbling) touch model.
vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Text: (props: { children?: unknown; onPress?: () => void; accessibilityRole?: string }) => (
    <span
      role={props.accessibilityRole}
      onClick={props.onPress ? (e: { stopPropagation: () => void }) => { e.stopPropagation(); props.onPress!(); } : undefined}>
      {props.children as any}
    </span>
  ),
  Pressable: (props: { children?: unknown; onPress?: () => void; accessibilityLabel?: string }) => (
    <button
      aria-label={props.accessibilityLabel}
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); props.onPress?.(); }}>
      {props.children as any}
    </button>
  ),
  TextInput: (props: { value?: string; onChangeText?: (t: string) => void; placeholder?: string }) => (
    <input
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChangeText?.(e.target.value)}
    />
  ),
  ScrollView: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Modal: (props: { children?: unknown; visible?: boolean }) => (props.visible ? <div>{props.children as any}</div> : null),
  KeyboardAvoidingView: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Platform: { OS: 'ios' },
  useWindowDimensions: () => ({ height: 800, width: 400 }),
}));

vi.mock('expo-router', () => ({ router: { push: pushMock } }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: { colors: {}, fonts: { sansMedium: 'System' } } }),
}));

const { GenerateOutfitsModal } = await import('@/components/closet/GenerateOutfitsModal');

function fakeHook(overrides: Partial<{ isOpen: boolean; formality: string; additionalDetails: string }> = {}) {
  return {
    isOpen: true,
    close: vi.fn(),
    formality: 'smart-casual' as const,
    setFormality: vi.fn(),
    additionalDetails: '',
    setAdditionalDetails: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

function textOf(container: HTMLElement) {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('GenerateOutfitsModal — Build Around a Piece cross-link', () => {
  it('renders the helper sentence in Additional Details once expanded', () => {
    const hook = fakeHook();
    const { container } = render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByLabelText('Expand Additional Details'));
    expect(textOf(container)).toContain('Want to start with a specific item you own?');
    expect(textOf(container)).toContain('and keep the outfit entirely from your closet.');
  });

  it('"Build Around a Piece" renders as an interactive inline link', () => {
    const hook = fakeHook();
    render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByLabelText('Expand Additional Details'));
    const link = screen.getByText('Build Around a Piece');
    expect(link.getAttribute('role')).toBe('link');
  });

  it('tapping the link closes this modal cleanly (no stacked modal)', () => {
    const hook = fakeHook();
    render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByLabelText('Expand Additional Details'));
    fireEvent.click(screen.getByText('Build Around a Piece'));
    expect(hook.close).toHaveBeenCalledTimes(1);
  });

  it('tapping the link navigates into /create-look with closetOnly=true', () => {
    const hook = fakeHook();
    render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByLabelText('Expand Additional Details'));
    fireEvent.click(screen.getByText('Build Around a Piece'));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const call = pushMock.mock.calls[0]![0];
    expect(call.pathname).toBe('/create-look');
    expect(call.params.closetOnly).toBe('true');
    expect(typeof call.params.fresh).toBe('string');
  });

  it('tapping the link does not also trigger the normal Generate navigation', () => {
    const hook = fakeHook();
    render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByLabelText('Expand Additional Details'));
    fireEvent.click(screen.getByText('Build Around a Piece'));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0]![0].pathname).not.toBe('/generate-outfits');
  });
});

describe('GenerateOutfitsModal — normal entry regression', () => {
  it('the Generate button still closes the modal and navigates to /generate-outfits unchanged', () => {
    const hook = fakeHook({ formality: 'business', additionalDetails: 'black-tie gala' });
    render(<GenerateOutfitsModal hook={hook as any} />);
    fireEvent.click(screen.getByText('Generate'));

    expect(hook.close).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledTimes(1);
    const call = pushMock.mock.calls[0]![0];
    expect(call.pathname).toBe('/generate-outfits');
    expect(call.params.formality).toBe('business');
    expect(call.params.additionalDetails).toBe('black-tie gala');
  });

  it('the modal title and closet-only framing are unchanged', () => {
    const hook = fakeHook();
    const { container } = render(<GenerateOutfitsModal hook={hook as any} />);
    expect(textOf(container)).toContain('Generate 5 Outfits');
    expect(textOf(container)).toContain('Built entirely from your closet');
  });
});
