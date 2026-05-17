// ─────────────────────────────────────────────────────────────────────────────
// Share handoff — bridges the iOS Share Extension to the running app.
//
// The Share Extension writes an image + JSON sidecar into the App Group
// container. It opportunistically tries `openURL:` via the responder chain
// to bring the main app forward, but Apple has tightened that path on
// iOS 17/18 so we treat auto-launch as best-effort. The reliable channel
// is the App Group container scan that fires on every cold-start and on
// every AppState 'active' transition.
//
// Diagnostics: any time a scan runs we write a snapshot of what we found
// (container resolved? files seen? errors?) into the in-memory diagnostics
// object exposed by `getShareDiagnostics()`. The fit-check screen reads this
// so the user can see what's happening if the handoff misfires.
//
// Routing: instead of calling router.push from the module (which races the
// navigation container on cold start), we publish to the pending-share
// singleton and let `useShareHandoffRouter()` — mounted inside the navigator
// tree in _layout.tsx — perform the push when both the navigator and the
// share are ready.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useNavigationContainerRef } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';

import { log, recordError } from '@/lib/crashlytics';

const HOSTNAME = 'share-handoff';
const ACTION_CLOSET_FIT_CHECK = 'closet_fit_check';
const FIT_CHECK_ROUTE = '/closet-fit-check';

// ── Public shape ─────────────────────────────────────────────────────────────

export type PendingShare = {
  id: string;
  localUri: string;
  fileName: string;
  action: typeof ACTION_CLOSET_FIT_CHECK;
  consumedAt: string;
};

export type ShareDiagnostics = {
  /** Last App Group ID we resolved (whichever fallback succeeded). */
  appGroupId: string | null;
  /** Whether `Paths.appleSharedContainers` exposed the resolved App Group. */
  appGroupContainerResolved: boolean;
  /** Absolute container path if resolved. */
  appGroupContainerPath: string | null;
  /** Last error encountered while resolving / scanning the App Group. */
  lastError: string | null;
  /** Most recent scan result. */
  lastScan: {
    at: string;
    candidatesFound: number;
    pickedShareId: string | null;
  } | null;
  /** Most recent URL handoff parse. */
  lastUrlHandoff: {
    at: string;
    url: string;
    matched: boolean;
  } | null;
};

// ── In-memory singletons ─────────────────────────────────────────────────────

let pendingShare: PendingShare | null = null;
const subscribers = new Set<(share: PendingShare | null) => void>();
const processedShareIds = new Set<string>();

const diagnostics: ShareDiagnostics = {
  appGroupId: null,
  appGroupContainerResolved: false,
  appGroupContainerPath: null,
  lastError: null,
  lastScan: null,
  lastUrlHandoff: null,
};

export function getShareDiagnostics(): ShareDiagnostics {
  return { ...diagnostics };
}

function notify() {
  for (const listener of subscribers) listener(pendingShare);
}

function setPendingShare(share: PendingShare | null) {
  pendingShare = share;
  notify();
}

export function getPendingShare(): PendingShare | null {
  return pendingShare;
}

export function consumePendingShare(): PendingShare | null {
  const current = pendingShare;
  setPendingShare(null);
  return current;
}

export function subscribePendingShare(listener: (share: PendingShare | null) => void): () => void {
  subscribers.add(listener);
  listener(pendingShare);
  return () => {
    subscribers.delete(listener);
  };
}

// ── App Group identifier resolution ──────────────────────────────────────────
// Try (1) expo-constants extra (set by the config plugin), then (2) derive from
// the runtime bundle id via expo-application — by far the most reliable source.
// (3) Hardcoded production fallback as a last resort.

const APP_GROUP_PROD_DEFAULT = 'group.com.krispyk84.styleassistant';

function getAppGroupIdentifier(): string {
  const fromExtra = (Constants.expoConfig?.extra as { shareExtension?: { appGroupIdentifier?: unknown } } | undefined)
    ?.shareExtension?.appGroupIdentifier;
  if (typeof fromExtra === 'string' && fromExtra.startsWith('group.')) {
    diagnostics.appGroupId = fromExtra;
    return fromExtra;
  }
  const bundleId = Application.applicationId;
  if (bundleId) {
    const derived = `group.${bundleId}`;
    diagnostics.appGroupId = derived;
    return derived;
  }
  diagnostics.appGroupId = APP_GROUP_PROD_DEFAULT;
  return APP_GROUP_PROD_DEFAULT;
}

function appGroupSharesDirectory(): Directory | null {
  const id = getAppGroupIdentifier();
  let containers: Record<string, Directory> = {};
  try {
    containers = Paths.appleSharedContainers;
  } catch (err) {
    diagnostics.lastError = `appleSharedContainers threw: ${(err as Error)?.message ?? String(err)}`;
    return null;
  }
  const container = containers[id];
  if (!container) {
    diagnostics.appGroupContainerResolved = false;
    diagnostics.appGroupContainerPath = null;
    diagnostics.lastError = `App Group "${id}" not in appleSharedContainers (keys: ${Object.keys(containers).join(', ') || 'none'})`;
    return null;
  }
  diagnostics.appGroupContainerResolved = true;
  diagnostics.appGroupContainerPath = container.uri;
  return new Directory(container, 'pendingShares');
}

// ── Core ingestion ───────────────────────────────────────────────────────────

type ShareInput = {
  id: string;
  imageUri: string;
  sidecarUri: string | null;
};

function processShare(input: ShareInput) {
  const { id, imageUri, sidecarUri } = input;
  if (processedShareIds.has(id)) return;

  const sourceFile = new File(imageUri);
  if (!sourceFile.exists) {
    log(`[share-handoff] source file missing for ${id} at ${imageUri}`);
    return;
  }

  try {
    const cacheDir = `${Paths.cache.uri.replace(/\/$/, '')}/shared-images/`;
    const cacheDirHandle = new Directory(cacheDir);
    if (!cacheDirHandle.exists) {
      cacheDirHandle.create({ intermediates: true, idempotent: true });
    }

    const rawExt = sourceFile.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = /^[a-z0-9]+$/.test(rawExt) && rawExt.length <= 5 ? rawExt : 'jpg';
    const fileName = `${id}.${safeExt}`;
    const destFile = new File(cacheDir, fileName);
    if (destFile.exists) destFile.delete();
    sourceFile.copy(destFile);

    // Best-effort cleanup of App Group copies so the next share doesn't see stale.
    try { sourceFile.delete(); } catch { /* best-effort */ }
    if (sidecarUri) {
      try {
        const sidecar = new File(sidecarUri);
        if (sidecar.exists) sidecar.delete();
      } catch { /* best-effort */ }
    }

    processedShareIds.add(id);
    setPendingShare({
      id,
      localUri: destFile.uri,
      fileName,
      action: ACTION_CLOSET_FIT_CHECK,
      consumedAt: new Date().toISOString(),
    });
  } catch (err) {
    diagnostics.lastError = `processShare: ${(err as Error)?.message ?? String(err)}`;
    recordError(err instanceof Error ? err : new Error(String(err)), 'share_handoff_process');
  }
}

// ── URL parsing path ─────────────────────────────────────────────────────────

function parseHandoffUrl(rawUrl: string | null | undefined): { id: string; path: string; action: string } | null {
  if (!rawUrl) return null;
  let parsed: Linking.ParsedURL;
  try {
    parsed = Linking.parse(rawUrl);
  } catch {
    return null;
  }
  if (parsed.hostname !== HOSTNAME) return null;
  const qp = parsed.queryParams ?? {};
  const id = typeof qp.id === 'string' ? qp.id : null;
  const path = typeof qp.path === 'string' ? qp.path : null;
  const action = typeof qp.action === 'string' ? qp.action : ACTION_CLOSET_FIT_CHECK;
  if (!id || !path) return null;
  return { id, path, action };
}

function importShareFromUrl(rawUrl: string | null | undefined) {
  diagnostics.lastUrlHandoff = {
    at: new Date().toISOString(),
    url: rawUrl ?? '',
    matched: false,
  };
  const parsed = parseHandoffUrl(rawUrl);
  if (!parsed) return;
  if (parsed.action !== ACTION_CLOSET_FIT_CHECK) return;
  diagnostics.lastUrlHandoff.matched = true;
  const imageUri = parsed.path.startsWith('file://') ? parsed.path : `file://${parsed.path}`;
  const sidecarUri = imageUri.replace(/\.[^./]+$/, '.json');
  processShare({ id: parsed.id, imageUri, sidecarUri });
}

// ── Foreground scan path ─────────────────────────────────────────────────────

function scanAppGroupForPendingShares() {
  const dir = appGroupSharesDirectory();
  const at = new Date().toISOString();
  if (!dir || !dir.exists) {
    diagnostics.lastScan = { at, candidatesFound: 0, pickedShareId: null };
    return;
  }

  let entries: (Directory | File)[] = [];
  try {
    entries = dir.list();
  } catch (err) {
    diagnostics.lastError = `dir.list threw: ${(err as Error)?.message ?? String(err)}`;
    diagnostics.lastScan = { at, candidatesFound: 0, pickedShareId: null };
    log(`[share-handoff] could not list App Group directory: ${(err as Error)?.message ?? String(err)}`);
    return;
  }

  type Candidate = { id: string; imageUri: string; sidecarUri: string };
  const candidates: Candidate[] = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (!entry.uri.endsWith('.json')) continue;

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(entry.textSync()) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (meta['action'] !== ACTION_CLOSET_FIT_CHECK) continue;
    const id = typeof meta['id'] === 'string' ? meta['id'] : null;
    const imagePath = typeof meta['imagePath'] === 'string' ? meta['imagePath'] : null;
    if (!id || !imagePath) continue;
    if (processedShareIds.has(id)) continue;
    const imageUri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
    candidates.push({ id, imageUri, sidecarUri: entry.uri });
  }

  if (!candidates.length) {
    diagnostics.lastScan = { at, candidatesFound: 0, pickedShareId: null };
    return;
  }

  // Process newest first (ids are timestamp-based: `share-<ms>`).
  candidates.sort((a, b) => b.id.localeCompare(a.id));
  const picked = candidates[0]!;
  diagnostics.lastScan = { at, candidatesFound: candidates.length, pickedShareId: picked.id };
  processShare(picked);
}

// ── Listener install — call once at module load ───────────────────────────────

let listenerInstalled = false;
let urlSubscription: { remove: () => void } | null = null;
let appStateSubscription: { remove: () => void } | null = null;

export function installShareHandoffListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  // 1) Cold-start URL — if iOS launched us via openURL.
  Linking.getInitialURL()
    .then((url) => {
      if (url) importShareFromUrl(url);
    })
    .catch(() => undefined);

  // 2) Warm-foreground URLs — same code path.
  urlSubscription = Linking.addEventListener('url', (event) => {
    importShareFromUrl(event.url);
  });

  // 3) Foreground scan — runs on listener install (cold start) and on every
  //    AppState 'active' transition (warm reopen after a share).
  scanAppGroupForPendingShares();
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      scanAppGroupForPendingShares();
    }
  });
}

export function uninstallShareHandoffListener() {
  urlSubscription?.remove();
  appStateSubscription?.remove();
  urlSubscription = null;
  appStateSubscription = null;
  listenerInstalled = false;
}

// ── React hooks ──────────────────────────────────────────────────────────────

export function usePendingShare(): PendingShare | null {
  const [share, setShare] = useState<PendingShare | null>(pendingShare);
  useEffect(() => subscribePendingShare(setShare), []);
  return share;
}

/**
 * Mount inside the navigator tree (in _layout.tsx). Waits for the navigation
 * container to be ready before pushing /closet-fit-check, which avoids the
 * cold-start race where the share is queued before any route exists.
 *
 * Only navigates on a NEW share (id change) so it doesn't keep re-pushing if
 * the user navigates away while a pending share is in memory.
 */
export function useShareHandoffRouter() {
  const navRef = useNavigationContainerRef();
  const share = usePendingShare();
  const [lastRoutedId, setLastRoutedId] = useState<string | null>(null);

  useEffect(() => {
    if (!share) return;
    if (lastRoutedId === share.id) return;

    let cancelled = false;
    let attempts = 0;
    const tryRoute = () => {
      if (cancelled) return;
      attempts += 1;
      if (!navRef.isReady()) {
        if (attempts < 50) setTimeout(tryRoute, 100);
        return;
      }
      try {
        router.push(FIT_CHECK_ROUTE as never);
        setLastRoutedId(share.id);
      } catch (err) {
        diagnostics.lastError = `router.push: ${(err as Error)?.message ?? String(err)}`;
        if (attempts < 50) setTimeout(tryRoute, 100);
      }
    };
    tryRoute();
    return () => {
      cancelled = true;
    };
  }, [share, lastRoutedId, navRef]);
}
