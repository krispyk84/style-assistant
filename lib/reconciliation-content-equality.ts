// Phase 2B2 (sync redesign) — canonical semantic-equality helper shared by
// every domain adapter's `compareContent`. Never raw JSON.stringify: two
// content objects can be genuinely equal while differing in key insertion
// order (e.g. a server-returned row destructured in a different field
// order than a locally-constructed object), which JSON.stringify would
// incorrectly treat as unequal.
//
// Business-timestamp rule (§15, applied consistently across all four
// domains): each domain's own "when this happened" field (savedAt /
// assignedAt) is EXCLUDED from equality by the caller before this function
// ever sees the two objects — never by this function guessing which
// fields matter. Reasoning: (1) for the lost-CAS-acknowledgement recovery
// case this equality check primarily exists for, the timestamp would be
// byte-identical anyway (the same local write attempt sent it once); (2)
// for the legacy Case L equality check, a device-generated business
// timestamp carries display meaning, not synchronization identity (the
// same conclusion the Phase 2A timestamp-trust analysis, §B.1, already
// reached for conflict *ordering* — extended here to equality), so two
// records describing the same real content shouldn't be treated as a
// conflict merely because they were saved/assigned at different clock
// readings. This is a deliberate, tested choice per domain, not an
// automatic exclusion — see each adapter's own compareContent for exactly
// which field it strips before calling this.
export function canonicalDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false; // primitives already handled by a===b above

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, index) => canonicalDeepEqual(item, b[index]));
  }

  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();
  if (aKeys.length !== bKeys.length) return false;
  if (aKeys.some((key, index) => key !== bKeys[index])) return false;

  return aKeys.every((key) => canonicalDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
