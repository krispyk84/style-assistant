// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Pressable: (props: {
    children?: unknown;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityState?: { selected?: boolean };
  }) => (
    <button
      aria-label={props.accessibilityLabel}
      aria-pressed={props.accessibilityState?.selected ?? false}
      onClick={props.onPress}>
      {props.children as any}
    </button>
  ),
}));
vi.mock('expo-image', () => ({ Image: () => null }));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));
vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: { colors: { accent: '#000', border: '#ccc', card: '#eee', surface: '#fff' } } }),
}));

const { StylistPicker } = await import('@/components/forms/StylistPicker');

afterEach(() => {
  cleanup();
});

function textOf(container: HTMLElement) {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('StylistPicker — Choose Your Stylist', () => {
  it('renders both stylists with name and one-line description', () => {
    const { container } = render(<StylistPicker selectedId={null} onSelect={vi.fn()} />);
    const text = textOf(container);
    expect(text).toContain('Vittorio');
    expect(text).toContain('Refined, tailored and timeless.');
    expect(text).toContain('Alessandra');
    expect(text).toContain('Current, expressive and a little unexpected.');
  });

  it('selecting Vittorio calls onSelect with "vittorio"', () => {
    const onSelect = vi.fn();
    render(<StylistPicker selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Choose Vittorio'));
    expect(onSelect).toHaveBeenCalledWith('vittorio');
  });

  it('selecting Alessandra calls onSelect with "alessandra"', () => {
    const onSelect = vi.fn();
    render(<StylistPicker selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('Choose Alessandra'));
    expect(onSelect).toHaveBeenCalledWith('alessandra');
  });

  it('reflects the selected stylist via accessibilityState, and only that one', () => {
    render(<StylistPicker selectedId="alessandra" onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Choose Alessandra').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Choose Vittorio').getAttribute('aria-pressed')).toBe('false');
  });
});
