import {
  createClosetOutfitFavouriteViaRpc,
  createClosetOutfitWeekPlanItemViaRpc,
  deleteClosetOutfitFavouriteViaRpc,
  deleteClosetOutfitWeekPlanItemViaRpc,
  updateClosetOutfitFavouriteViaRpc,
  updateClosetOutfitWeekPlanItemViaRpc,
} from '@/lib/closet-outfit-sync';
import {
  readOneClosetWeekPlanItemLocal,
  readOneSavedClosetOutfitLocal,
  removeOneClosetWeekPlanItemLocal,
  removeOneSavedClosetOutfitLocal,
  writeOneClosetWeekPlanItemLocal,
  writeOneSavedClosetOutfitLocal,
  type ClosetWeekPlanItem,
  type SavedClosetOutfit,
} from '@/lib/closet-outfit-storage';
import { canonicalDeepEqual } from '@/lib/reconciliation-content-equality';
import type { DomainAdapter, RpcMutationResult } from '@/lib/reconciliation-executor';
import {
  readOneSavedOutfitLocal,
  removeOneSavedOutfitLocal,
  writeOneSavedOutfitLocal,
} from '@/lib/saved-outfits-storage';
import {
  createSavedOutfitViaRpc,
  createWeekPlanItemViaRpc,
  deleteSavedOutfitViaRpc,
  deleteWeekPlanItemViaRpc,
  updateSavedOutfitViaRpc,
  updateWeekPlanItemViaRpc,
} from '@/lib/supabase-data';
import {
  readOneWeekPlanItemLocal,
  removeOneWeekPlanItemLocal,
  writeOneWeekPlanItemLocal,
} from '@/lib/week-plan-storage';
import type { SavedOutfit, WeekPlannedOutfit } from '@/types/style';

// Phase 2B2 (sync redesign) — the four concrete DomainAdapter<T> objects
// lib/reconciliation-executor.ts's executeReconciliation calls into. No
// current caller assembles or uses these — they exist as tested, callable
// capability only (docs/sync-phase2a-reconciliation-spec.md's Phase 3
// cutover section explains why activating them is a separate, later
// decision). Each adapter is a plain object of functions, not a class or
// factory — deliberately the smallest thing that satisfies the interface.

// ── saved-outfits (direct-Supabase, document domain) ────────────────────
// compareContent excludes `savedAt` — see
// lib/reconciliation-content-equality.ts's top-of-file note: a business
// display timestamp, not part of this record's semantic identity for sync
// purposes (the exact same reasoning the Phase 2A timestamp-trust analysis
// applied to conflict ordering, extended here to equality).
export const savedOutfitAdapter: DomainAdapter<SavedOutfit> = {
  writeLocal: (_id, content) => writeOneSavedOutfitLocal(content),
  removeLocal: (id) => removeOneSavedOutfitLocal(id),
  createServer: (_id, content) => createSavedOutfitViaRpc(content) as Promise<RpcMutationResult<SavedOutfit>>,
  updateServer: (_id, baseVersion, content) => updateSavedOutfitViaRpc(content, baseVersion) as Promise<RpcMutationResult<SavedOutfit>>,
  deleteServer: (id, baseVersion) => deleteSavedOutfitViaRpc(id, baseVersion) as Promise<RpcMutationResult<SavedOutfit>>,
  compareContent: (a, b) => canonicalDeepEqual({ ...a, savedAt: undefined }, { ...b, savedAt: undefined }),
};

/** Exposed for a future execution layer that needs to read current local content before building an ExecutionRequest — not used by the adapter object itself. */
export async function readSavedOutfitForReconciliation(id: string): Promise<SavedOutfit | null> {
  return readOneSavedOutfitLocal(id);
}

// ── week-plan (direct-Supabase, slot domain) ────────────────────────────
// compareContent excludes `assignedAt` for the same reason as savedAt
// above. Deliberately does NOT exclude dayLabel/input/recommendation —
// those describe the actual assignment a user would notice changed.
export const weekPlanAdapter: DomainAdapter<WeekPlannedOutfit> = {
  writeLocal: (_id, content) => writeOneWeekPlanItemLocal(content),
  removeLocal: (id) => removeOneWeekPlanItemLocal(id),
  createServer: (_id, content) => createWeekPlanItemViaRpc(content) as Promise<RpcMutationResult<WeekPlannedOutfit>>,
  updateServer: (_id, baseVersion, content) => updateWeekPlanItemViaRpc(content, baseVersion) as Promise<RpcMutationResult<WeekPlannedOutfit>>,
  deleteServer: (id, baseVersion) => deleteWeekPlanItemViaRpc(id, baseVersion) as Promise<RpcMutationResult<WeekPlannedOutfit>>,
  compareContent: (a, b) => canonicalDeepEqual({ ...a, assignedAt: undefined }, { ...b, assignedAt: undefined }),
};

export async function readWeekPlanItemForReconciliation(dayKey: string): Promise<WeekPlannedOutfit | null> {
  return readOneWeekPlanItemLocal(dayKey);
}

// ── closet-outfit-favourites (backend-mediated, document domain) ───────
export const closetOutfitFavouriteAdapter: DomainAdapter<SavedClosetOutfit> = {
  writeLocal: (_id, content) => writeOneSavedClosetOutfitLocal(content),
  removeLocal: (id) => removeOneSavedClosetOutfitLocal(id),
  createServer: (_id, content) => createClosetOutfitFavouriteViaRpc(content) as Promise<RpcMutationResult<SavedClosetOutfit>>,
  updateServer: (_id, baseVersion, content) => updateClosetOutfitFavouriteViaRpc(content, baseVersion) as Promise<RpcMutationResult<SavedClosetOutfit>>,
  deleteServer: (id, baseVersion) => deleteClosetOutfitFavouriteViaRpc(id, baseVersion) as Promise<RpcMutationResult<SavedClosetOutfit>>,
  compareContent: (a, b) => canonicalDeepEqual({ ...a, savedAt: undefined }, { ...b, savedAt: undefined }),
};

export async function readClosetOutfitFavouriteForReconciliation(id: string): Promise<SavedClosetOutfit | null> {
  return readOneSavedClosetOutfitLocal(id);
}

// ── closet-outfit-week-plan (backend-mediated, slot domain) ────────────
export const closetOutfitWeekPlanAdapter: DomainAdapter<ClosetWeekPlanItem> = {
  writeLocal: (_id, content) => writeOneClosetWeekPlanItemLocal(content),
  removeLocal: (id) => removeOneClosetWeekPlanItemLocal(id),
  createServer: (_id, content) => createClosetOutfitWeekPlanItemViaRpc(content) as Promise<RpcMutationResult<ClosetWeekPlanItem>>,
  updateServer: (_id, baseVersion, content) => updateClosetOutfitWeekPlanItemViaRpc(content, baseVersion) as Promise<RpcMutationResult<ClosetWeekPlanItem>>,
  deleteServer: (id, baseVersion) => deleteClosetOutfitWeekPlanItemViaRpc(id, baseVersion) as Promise<RpcMutationResult<ClosetWeekPlanItem>>,
  compareContent: (a, b) => canonicalDeepEqual({ ...a, assignedAt: undefined }, { ...b, assignedAt: undefined }),
};

export async function readClosetOutfitWeekPlanItemForReconciliation(dayKey: string): Promise<ClosetWeekPlanItem | null> {
  return readOneClosetWeekPlanItemLocal(dayKey);
}
