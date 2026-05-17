// ─────────────────────────────────────────────────────────────────────────────
// Share handoff — bridges the iOS Share Extension to the running app.
//
// The Share Extension writes an image + JSON sidecar into the App Group
// container, then opportunistically calls `openURL:` via the responder chain
// to bring the main app forward. iOS 17/18 has made that selector unreliable
// from share extensions, so this module supports BOTH paths:
//
//   1. URL handoff — `Linking.getInitialURL` + `addEventListener('url')` parse
//      `<scheme>://share-handoff?id=...&path=...` and ingest the file.
//   2. Foreground scan — every time AppState turns active (and on listener
//      install) we read the App Group container directly via
//      `Paths.appleSharedContainers[groupId]/pendingShares/` and ingest the
//      newest pending share. This is the resilient fallback for cases where
//      the responder-chain trick silently fails or the user opens the app
//      manually after sharing.
//
// Both paths share a single `processShare` core that copies the image to the
// app's cache, deletes the App Group copy + sidecar, updates the in-memory
// singleton, and routes to /closet-fit-check.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Directory, File, Paths } from 'expo-file-system';

import { log, recordError } from '@/lib/crashlytics';

const HOSTNAME = 'share-handoff';
const ACTION_CLOSET_FIT_CHECK = 'closet_fit_check';
const FIT_CHECK_ROUTE = '/closet-fit-check';

// ── Public shape ─────────────────────────────────────────────────────────────

export type PendingShare = {
  /** Stable id minted by the share extension (e.g. "share-1747654321000"). */
  id: string;
  /** file:// URI in the app's cache directory. Safe to upload directly. */
  localUri: string;
  /** Original filename so the upload pipeline can pick a reasonable mimeType. */
  fileName: string;
  /** Originating action — currently always closet_fit_check. */
  action: typeof ACTION_CLOSET_FIT_CHECK;
  /** ISO timestamp of when the URL was parsed. */
  consumedAt: string;
};

// ── In-memory singleton + subscriber list ────────────────────────────────────

let pendingShare: PendingShare | null = null;
const subscribers = new Set<(share: PendingShare | null) => void>();
// Shares we've already ingested (by id) so the foreground scan can't process
// the same file twice if both the URL handoff and the scan fire for it.
const processedShareIds = new Set<string>();

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

function getAppGroupIdentifier(): string | null {
  const extras = (Constants.expoConfig?.extra ?? {}) as { shareExtension?: { appGroupIdentifier?: unknown } };
  const id = extras.shareExtension?.appGroupIdentifier;
  if (typeof id === 'string' && id.length > 0) return id;
  return null;
}

function appGroupSharesDirectory(): Directory | null {
  const id = getAppGroupIdentifier();
  if (!id) return null;
  let containers: Record<string, Directory> = {};
  try {
    containers = Paths.appleSharedContainers;
  } catch {
    return null;
  }
  const container = containers[id];
  if (!container) return null;
  return new Directory(container, 'pendingShares');
}

// ── Core ingestion ───────────────────────────────────────────────────────────

type ShareInput = {
  id: string;
  imageUri: string;          // file:// URI of the image inside the App Group
  sidecarUri: string | null; // file:// URI of the .json sidecar to delete after consume
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

    routeToFitCheck();
  } catch (err) {
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
  const parsed = parseHandoffUrl(rawUrl);
  if (!parsed) return;
  if (parsed.action !== ACTION_CLOSET_FIT_CHECK) return;
  const imageUri = parsed.path.startsWith('file://') ? parsed.path : `file://${parsed.path}`;
  const sidecarUri = imageUri.replace(/\.[^./]+$/, '.json');
  processShare({ id: parsed.id, imageUri, sidecarUri });
}

// ── Foreground scan path ─────────────────────────────────────────────────────
// Reads pendingShares/ in the App Group container directly. Picks the NEWEST
// pending image whose JSON sidecar matches our action. Runs on every AppState
// → active transition and on listener install (covers cold-start).

function scanAppGroupForPendingShares() {
  const dir = appGroupSharesDirectory();
  if (!dir || !dir.exists) return;

  let entries: (Directory | File)[] = [];
  try {
    entries = dir.list();
  } catch (err) {
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

  if (!candidates.length) return;

  // Process newest first (ids are timestamp-based: `share-<ms>`).
  candidates.sort((a, b) => b.id.localeCompare(a.id));
  processShare(candidates[0]!);
}

// ── Routing ──────────────────────────────────────────────────────────────────

function routeToFitCheck() {
  // expo-router is safe to call from a top-level listener: it queues until the
  // navigation container is ready. We also retry briefly on cold-start in case
  // the listener fires before the navigator mounts.
  let attempts = 0;
  const tryRoute = () => {
    attempts += 1;
    try {
      // Typed routes may not know /closet-fit-check on first generation; the
      // path is valid at runtime via expo-router.
      router.push(FIT_CHECK_ROUTE as never);
    } catch {
      if (attempts < 20) {
        setTimeout(tryRoute, 100);
      }
    }
  };
  tryRoute();
}

// ── Listener install — call once from the app root ───────────────────────────

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

  // 3) Foreground scan — runs whenever the app becomes active. Covers the
  //    case where the share extension's openURL trick silently fails AND the
  //    case where the user manually re-opens the app after sharing.
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

// ── React hook ───────────────────────────────────────────────────────────────

export function usePendingShare(): PendingShare | null {
  const [share, setShare] = useState<PendingShare | null>(pendingShare);
  useEffect(() => subscribePendingShare(setShare), []);
  return share;
}
