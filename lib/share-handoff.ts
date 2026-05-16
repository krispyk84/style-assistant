// ─────────────────────────────────────────────────────────────────────────────
// Share handoff — bridges the iOS Share Extension to the running app.
//
// The Share Extension writes an image + JSON sidecar into the App Group
// container and opens the main app via `<scheme>://share-handoff?path=...&id=...`.
// This module:
//   1. Subscribes to incoming URLs (cold-start + warm-foreground) via expo-linking.
//   2. Parses share-handoff URLs.
//   3. Copies the shared image into the app's cache directory so the App Group
//      file can be cleaned up immediately (cache is durable across launches).
//   4. Stores the consumed share in an in-memory singleton.
//   5. Exposes a React hook (`usePendingShare`) so screens can pick it up.
//   6. Exposes a manual `consumePendingShare()` so the consumer can clear it
//      once the share has been routed into the feature.
//
// Auto-routing into "/closet-fit-check" happens from the URL listener as
// soon as a share-handoff URL is parsed, so the user lands on the right
// screen regardless of where they were when the share arrived.
// ─────────────────────────────────────────────────────────────────────────────

import { router } from 'expo-router';
import * as Linking from 'expo-linking';
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

// ── URL parsing + import pipeline ────────────────────────────────────────────

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

async function importShareFromUrl(rawUrl: string | null | undefined) {
  const parsed = parseHandoffUrl(rawUrl);
  if (!parsed) return;
  if (parsed.action !== ACTION_CLOSET_FIT_CHECK) return;

  // The path is an absolute filesystem path written by the Share Extension into
  // the App Group container. Build a file:// URI so expo-file-system can read it.
  const sourceUri = parsed.path.startsWith('file://') ? parsed.path : `file://${parsed.path}`;
  const sourceFile = new File(sourceUri);

  try {
    if (!sourceFile.exists) {
      log(`[share-handoff] source file missing for ${parsed.id} at ${parsed.path}`);
      return;
    }

    const cacheDir = `${Paths.cache.uri.replace(/\/$/, '')}/shared-images/`;
    const cacheDirHandle = new Directory(cacheDir);
    if (!cacheDirHandle.exists) {
      cacheDirHandle.create({ intermediates: true, idempotent: true });
    }

    // Derive a stable cached filename per share id so repeated parses of the
    // same URL don't pile up cache copies.
    const ext = sourceFile.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = /^[a-z0-9]+$/.test(ext) && ext.length <= 5 ? ext : 'jpg';
    const fileName = `${parsed.id}.${safeExt}`;
    const destFile = new File(cacheDir, fileName);
    if (destFile.exists) {
      destFile.delete();
    }
    sourceFile.copy(destFile);

    // Clean up the App Group copy + matching JSON sidecar so the next share
    // doesn't see stale entries. The metadata file lives next to the image
    // with the same id and a .json extension.
    try {
      sourceFile.delete();
    } catch {
      // best-effort cleanup
    }
    try {
      const metaUri = sourceUri.replace(/\.[^./]+$/, '.json');
      const metaFile = new File(metaUri);
      if (metaFile.exists) metaFile.delete();
    } catch {
      // best-effort
    }

    setPendingShare({
      id: parsed.id,
      localUri: destFile.uri,
      fileName,
      action: ACTION_CLOSET_FIT_CHECK,
      consumedAt: new Date().toISOString(),
    });

    routeToFitCheck();
  } catch (err) {
    recordError(err instanceof Error ? err : new Error(String(err)), 'share_handoff_import');
  }
}

function routeToFitCheck() {
  // expo-router is safe to call from a top-level listener: it queues until the
  // navigation container is ready. We also retry briefly on cold-start in case
  // the listener fires before the navigator mounts.
  let attempts = 0;
  const tryRoute = () => {
    attempts += 1;
    try {
      // The typed-routes generator may not yet know about /closet-fit-check on
      // the first run after adding the screen file; cast to `never` so tsc
      // accepts it. The path is valid at runtime via expo-router.
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
let unsubscribe: (() => void) | null = null;

export function installShareHandoffListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  // Cold-start URL
  Linking.getInitialURL()
    .then((url) => {
      if (url) void importShareFromUrl(url);
    })
    .catch(() => undefined);

  // Warm-foreground URLs
  const sub = Linking.addEventListener('url', (event) => {
    void importShareFromUrl(event.url);
  });
  unsubscribe = () => sub.remove();
}

export function uninstallShareHandoffListener() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  listenerInstalled = false;
}

// ── React hook ───────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

export function usePendingShare(): PendingShare | null {
  const [share, setShare] = useState<PendingShare | null>(pendingShare);
  useEffect(() => subscribePendingShare(setShare), []);
  return share;
}
