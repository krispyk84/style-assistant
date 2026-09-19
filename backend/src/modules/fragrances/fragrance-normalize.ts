// ── Fragrance normalization + catalog dedup key ───────────────────────────────
//
// Pure functions, deliberately dependency-free — this is the part of the
// catalog-dedup strategy most worth unit testing directly. Concentration is
// always part of the canonical key so distinct concentrations/flankers (EDT
// vs EDP vs Parfum, or a differently-named flanker) never collapse into one
// catalog row — see section 9 of the spec.

export function normalizeFragranceText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBrand(brand: string): string {
  return normalizeFragranceText(brand);
}

export function normalizeName(name: string): string {
  return normalizeFragranceText(name);
}

/** Concentration is normalized into the key too — absent/unrecognized concentration always maps to the same 'unknown' segment, never treated as a wildcard that matches every concentration. */
export function buildCanonicalKey(brand: string, name: string, concentration?: string | null): string {
  const normalizedBrand = normalizeBrand(brand);
  const normalizedName = normalizeName(name);
  const normalizedConcentration = concentration?.trim() ? normalizeFragranceText(concentration) : 'unknown';
  return `${normalizedBrand}::${normalizedName}::${normalizedConcentration}`;
}
