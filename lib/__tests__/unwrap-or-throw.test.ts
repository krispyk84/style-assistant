import { describe, expect, it, vi } from 'vitest';

import { unwrapOrThrow } from '@/lib/api/api-client';
import type { ApiResponse } from '@/types/api';

// api-client.ts transitively imports lib/app-version.ts -> expo-constants,
// whose real module drags in react-native internals (Flow syntax) that
// vitest/rolldown can't parse under plain Node — mocked the same way
// api-client-version-headers.test.ts does. vi.mock calls are hoisted above
// all imports by vitest, so this takes effect before api-client.ts loads.
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));

// Phase R6C — the shared helper extracted from the response-unwrap idiom
// duplicated across saved-trips/trip-outfits/wardrobe-score's API services:
//   if (!response.success || !response.data) throw new Error(response.error?.message ?? fallback);
//   return response.data;
// These tests protect that exact contract before any call site migrates to it.

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error: null };
}

function fail<T>(message: string | null): ApiResponse<T> {
  return { success: false, data: null, error: message === null ? null : { code: 'SOME_ERROR', message } };
}

describe('unwrapOrThrow', () => {
  it('success + data: returns response.data unchanged', () => {
    const data = { id: '1', title: 'Trip' };
    const response = ok(data);
    expect(unwrapOrThrow(response, 'fallback')).toBe(data); // same reference, not cloned
  });

  it('unsuccessful response + explicit server error message: throws the server message, not the fallback', () => {
    const response = fail<{ id: string }>('Server says no.');
    expect(() => unwrapOrThrow(response, 'Fallback message.')).toThrow('Server says no.');
  });

  it('unsuccessful response + no server message: throws the supplied fallback', () => {
    const response = fail<{ id: string }>(null);
    expect(() => unwrapOrThrow(response, 'Fallback message.')).toThrow('Fallback message.');
  });

  it('success=true but data is null: throws using the same message-precedence logic', () => {
    const response: ApiResponse<{ id: string }> = { success: true, data: null, error: { code: 'X', message: 'Explicit message.' } };
    expect(() => unwrapOrThrow(response, 'Fallback message.')).toThrow('Explicit message.');
  });

  it('success=true but data is null and no server message: throws the fallback', () => {
    const response: ApiResponse<{ id: string }> = { success: true, data: null, error: null };
    expect(() => unwrapOrThrow(response, 'Fallback message.')).toThrow('Fallback message.');
  });

  it('the thrown value is a real Error instance', () => {
    const response = fail<{ id: string }>(null);
    try {
      unwrapOrThrow(response, 'Fallback message.');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});
