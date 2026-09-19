// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

// ── What this file is ───────────────────────────────────────────────────────
//
// One editable row in the itinerary-upload review list ("Have an
// itinerary?" on the trip planner's Plans step). Proves the date label
// renders without a timezone off-by-one, that editing the summary only
// fires onChangeSummary for genuine post-mount edits (not the initial
// mount, mirroring AnchorItemCard's own mount-guard), and that remove works.

vi.mock('react-native', () => ({
  View: (props: { children?: unknown }) => <div>{props.children as any}</div>,
  Pressable: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={props.onPress}>{props.children as any}</button>
  ),
  TextInput: (props: { value?: string; onChangeText?: (text: string) => void }) => (
    <textarea value={props.value} onChange={(e) => props.onChangeText?.(e.target.value)} />
  ),
}));
vi.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));
vi.mock('@/components/ui/app-text', () => ({ AppText: (props: { children?: unknown }) => <>{props.children}</> }));

const { ItineraryDayCard } = await import('@/components/forms/ItineraryDayCard');

function textOf(container: HTMLElement) {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  cleanup();
});

describe('ItineraryDayCard', () => {
  it('renders the date as a readable label, not the raw ISO string', () => {
    const { container } = render(
      <ItineraryDayCard date="2026-09-24" summary="Conference all day" onChangeSummary={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(textOf(container)).toContain('Sep 24');
    expect(textOf(container)).not.toContain('2026-09-24');
  });

  it('does not fire onChangeSummary on mount', () => {
    const onChangeSummary = vi.fn();
    render(
      <ItineraryDayCard date="2026-09-24" summary="Conference all day" onChangeSummary={onChangeSummary} onRemove={vi.fn()} />,
    );
    expect(onChangeSummary).not.toHaveBeenCalled();
  });

  it('fires onChangeSummary with the edited text after the user edits it', () => {
    const onChangeSummary = vi.fn();
    const { getByDisplayValue } = render(
      <ItineraryDayCard date="2026-09-24" summary="Conference all day" onChangeSummary={onChangeSummary} onRemove={vi.fn()} />,
    );

    fireEvent.change(getByDisplayValue('Conference all day'), { target: { value: 'Conference all day, dinner after' } });

    expect(onChangeSummary).toHaveBeenCalledWith('Conference all day, dinner after');
  });

  it('fires onRemove when the remove control is pressed', () => {
    const onRemove = vi.fn();
    const { getByRole } = render(
      <ItineraryDayCard date="2026-09-24" summary="Conference all day" onChangeSummary={vi.fn()} onRemove={onRemove} />,
    );

    fireEvent.click(getByRole('button'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
