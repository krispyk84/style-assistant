import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase-js and AsyncStorage are mocked at the module boundary rather than
// imported for real: (1) the real client (lib/supabase.ts) constructs a
// RealtimeClient at import time, which throws under Node without a `ws`
// transport (the exact class of bug fixed backend-side this session) — not
// relevant to what's being tested here, so it's mocked away entirely rather
// than worked around; (2) this file's whole point is verifying HOW callers
// react to a resolved-vs-rejected Supabase response, which only requires
// controlling what supabase.from(...) resolves to, not a real client.
const { getSessionMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: getSessionMock },
    from: fromMock,
  },
}));

const { recordErrorMock } = vi.hoisted(() => ({ recordErrorMock: vi.fn() }));
vi.mock('@/lib/crashlytics', () => ({
  recordError: recordErrorMock,
  log: vi.fn(),
}));

const storageMock = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storageMock.set(key, value);
      return Promise.resolve();
    }),
  },
}));

const TEST_ITEM = {
  id: 'item-1',
  title: 'White Oxford Shirt',
  brand: 'Test Brand',
  size: 'M',
  category: 'Shirt',
  sketchStatus: 'ready',
  savedAt: '2026-01-01T00:00:00.000Z',
} as unknown as import('@/types/closet').ClosetItem;

// A chainable fake matching supabase-js's query-builder surface, configured
// per test to resolve/reject however that test needs.
function chainResolving(result: { error: unknown }) {
  const chain = {
    upsert: vi.fn().mockResolvedValue(result),
    delete: vi.fn(() => chain),
    eq: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function chainRejecting(error: unknown) {
  const chain = {
    upsert: vi.fn().mockRejectedValue(error),
    delete: vi.fn(() => chain),
    eq: vi.fn().mockRejectedValue(error),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.clear();
  getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
});

describe('supabase-data.ts — the three distinct outcomes a write can have', () => {
  it('a resolved SUCCESS ({error: null}) resolves normally', async () => {
    fromMock.mockReturnValue(chainResolving({ error: null }));
    const { upsertClosetItemToSupabase } = await import('@/lib/supabase-data');
    await expect(upsertClosetItemToSupabase(TEST_ITEM)).resolves.toBeUndefined();
  });

  it('a resolved FAILURE ({error: {...}}) throws — this is the fix: Supabase does not reject on an ordinary write failure', async () => {
    const supabaseError = { message: 'row-level security policy violation' };
    fromMock.mockReturnValue(chainResolving({ error: supabaseError }));
    const { upsertClosetItemToSupabase } = await import('@/lib/supabase-data');
    await expect(upsertClosetItemToSupabase(TEST_ITEM)).rejects.toBe(supabaseError);
  });

  it('an actually REJECTED promise (network exception) propagates as a rejection', async () => {
    const networkError = new Error('network down');
    fromMock.mockReturnValue(chainRejecting(networkError));
    const { upsertClosetItemToSupabase } = await import('@/lib/supabase-data');
    await expect(upsertClosetItemToSupabase(TEST_ITEM)).rejects.toBe(networkError);
  });

  it('delete: a resolved FAILURE throws too (same contract as upsert)', async () => {
    const supabaseError = { message: 'not found' };
    fromMock.mockReturnValue(chainResolving({ error: supabaseError }));
    const { deleteClosetItemFromSupabase } = await import('@/lib/supabase-data');
    await expect(deleteClosetItemFromSupabase('item-1')).rejects.toBe(supabaseError);
  });
});

describe('lib/closet-storage.ts saveClosetItem — caller-side handling of all three outcomes', () => {
  it('SUCCESS: local write still happens, recordError is never called', async () => {
    fromMock.mockReturnValue(chainResolving({ error: null }));
    const { saveClosetItem } = await import('@/lib/closet-storage');
    const items = await saveClosetItem(TEST_ITEM);
    expect(items).toHaveLength(1);
    // The cloud write is fire-and-forget (void ...catch(...)) — flush microtasks
    // so its .catch handler (or lack thereof) has had a chance to run.
    await new Promise((resolve) => setImmediate(resolve));
    expect(recordErrorMock).not.toHaveBeenCalled();
  });

  it('RESOLVED FAILURE: local write still happens (local-write-is-success UX preserved), but recordError IS called — this is exactly the gap the prior fix closed', async () => {
    const supabaseError = { message: 'row-level security policy violation' };
    fromMock.mockReturnValue(chainResolving({ error: supabaseError }));
    const { saveClosetItem } = await import('@/lib/closet-storage');
    const items = await saveClosetItem(TEST_ITEM);
    expect(items).toHaveLength(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(recordErrorMock).toHaveBeenCalledWith(supabaseError, 'closet_storage_save_upsert');
  });

  it('REJECTED PROMISE: local write still happens, recordError IS called', async () => {
    const networkError = new Error('network down');
    fromMock.mockReturnValue(chainRejecting(networkError));
    const { saveClosetItem } = await import('@/lib/closet-storage');
    const items = await saveClosetItem(TEST_ITEM);
    expect(items).toHaveLength(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(recordErrorMock).toHaveBeenCalledWith(networkError, 'closet_storage_save_upsert');
  });
});
