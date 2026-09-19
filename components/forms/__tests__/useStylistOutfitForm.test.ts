// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStylistOutfitForm } from '@/components/forms/useStylistOutfitForm';

describe('useStylistOutfitForm', () => {
  it('selecting a stylist sets stylistId and clears any stylist error', () => {
    const { result } = renderHook(() => useStylistOutfitForm());
    act(() => result.current.setStylistError('Choose a stylist to continue.'));
    act(() => result.current.selectStylist('alessandra'));
    expect(result.current.stylistId).toBe('alessandra');
    expect(result.current.stylistError).toBeNull();
  });

  it('updating the brief clears any brief error once non-empty', () => {
    const { result } = renderHook(() => useStylistOutfitForm());
    act(() => result.current.setBriefError('Tell your stylist what you need before generating.'));
    act(() => result.current.updateBrief('drinks with friends'));
    expect(result.current.stylistBrief).toBe('drinks with friends');
    expect(result.current.briefError).toBeNull();
  });

  it('an all-whitespace brief does not clear the brief error', () => {
    const { result } = renderHook(() => useStylistOutfitForm());
    act(() => result.current.setBriefError('Tell your stylist what you need before generating.'));
    act(() => result.current.updateBrief('   '));
    expect(result.current.briefError).toBe('Tell your stylist what you need before generating.');
  });

  it('closetOnly toggles and defaults to false', () => {
    const { result } = renderHook(() => useStylistOutfitForm());
    expect(result.current.closetOnly).toBe(false);
    act(() => result.current.toggleClosetOnly());
    expect(result.current.closetOnly).toBe(true);
    act(() => result.current.toggleClosetOnly());
    expect(result.current.closetOnly).toBe(false);
  });
});
