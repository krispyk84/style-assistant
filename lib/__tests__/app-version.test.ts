import { describe, it, expect, vi } from 'vitest';

import { APP_VERSION, APP_BUILD, appVersionHeaders } from '@/lib/app-version';

// expo-constants' real module drags in react-native internals (Flow
// syntax) that vitest/rolldown can't parse under plain Node — mocked here
// the same way this repo already mocks other Expo/RN SDK modules
// (@/lib/supabase, @react-native-async-storage/async-storage) rather than
// letting the test runner attempt to load the real native module. vi.mock
// calls are hoisted above imports by vitest regardless of their textual
// position, so this runs before @/lib/app-version's own import above.
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));

// Phase 3B2 (sync rollout gate) — the minimal app-version telemetry this
// checkpoint added. With expoConfig mocked to null (matching what the real
// module resolves to under plain Node with no Expo runtime), both constants
// fall back to 'unknown' — this proves the fallback behaves rather than
// throwing, which is the only thing worth asserting about a config-read
// constant.

describe('app-version', () => {
  it('APP_VERSION/APP_BUILD are non-empty strings (real value or the unknown fallback)', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(typeof APP_BUILD).toBe('string');
    expect(APP_BUILD.length).toBeGreaterThan(0);
  });

  it('appVersionHeaders returns exactly the two X-App-* headers', () => {
    expect(appVersionHeaders()).toEqual({
      'X-App-Version': APP_VERSION,
      'X-App-Build': APP_BUILD,
    });
  });
});
