import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CATEGORY_TO_GROUP as BACKEND_CATEGORY_TO_GROUP } from '../closet-taxonomy.js';

// Frontend (lib/closet-match-taxonomy.ts) and backend (closet-taxonomy.ts)
// intentionally keep separate copies of the category→garment-group taxonomy,
// per both files' own docblocks — they answer two different questions:
//   - Backend: which SLOT does this garment fill in deterministic outfit
//     building (Generate 5 Outfits closet-only, Create a Look closet-only,
//     Trip Planner full-closet)?
//   - Frontend: how similar is this closet item to an AI-described outfit
//     piece, for confidence-matching purposes (lib/closet-match.ts)? This
//     never assigns outfit slots.
// Most categories should map to the same group on both sides; a few are
// deliberately different because the two questions have different correct
// answers for that garment. This test reads the frontend file's actual
// current source (not importing it — it has React Native path aliases the
// backend project can't resolve) and fails on any UNDOCUMENTED difference,
// so a future taxonomy edit can't silently drift without a test noticing —
// while still allowing the documented, intentional ones below.
const FRONTEND_TAXONOMY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../lib/closet-match-taxonomy.ts',
);

const KNOWN_INTENTIONAL_DIVERGENCES: Record<string, { backend: string; frontend: string; reason: string }> = {
  Overshirt: {
    backend: 'overshirt',
    frontend: 'jacket',
    reason:
      "Backend: an overshirt fills the THERMAL LAYER slot (a mid-layer garment, like a cardigan or heavy shirt worn as a layering piece) — never OUTERWEAR, which is reserved for a genuine weatherproof outer shell. See closet-taxonomy.ts's SLOT_GROUPS.thermalLayer and TIER_SLOT_RULES. Frontend: lib/closet-match.ts groups it with 'jacket' purely for AI-piece-to-closet-item confidence matching (an overshirt visually/descriptively resembles a light jacket closely enough to count as a related match) — that file never assigns outfit slots, so the thermal-layer-vs-outerwear distinction doesn't apply to it.",
  },
};

function extractCategoryToGroup(source: string): Record<string, string> {
  const match = source.match(/export const CATEGORY_TO_GROUP: Record<string, string> = \{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error(
      'Could not locate CATEGORY_TO_GROUP in lib/closet-match-taxonomy.ts — has its declaration moved, been renamed, or changed shape? Update this test\'s parser to match.',
    );
  }
  const body = match[1]!;
  const entries: Record<string, string> = {};
  const entryPattern = /(?:'([^']+)'|([A-Za-z][\w-]*))\s*:\s*'([^']+)'/g;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryPattern.exec(body))) {
    const key = entryMatch[1] ?? entryMatch[2]!;
    entries[key] = entryMatch[3]!;
  }
  return entries;
}

describe('closet taxonomy — frontend/backend drift guard', () => {
  const frontendSource = readFileSync(FRONTEND_TAXONOMY_PATH, 'utf8');
  const frontendCategoryToGroup = extractCategoryToGroup(frontendSource);

  it('parser sanity check: found a plausible number of categories in the frontend file', () => {
    // Guards against the regex silently matching nothing (e.g. after a
    // formatting change) and every other assertion below passing vacuously.
    expect(Object.keys(frontendCategoryToGroup).length).toBeGreaterThan(20);
  });

  it('both sides define exactly the same set of closet categories', () => {
    const backendKeys = new Set(Object.keys(BACKEND_CATEGORY_TO_GROUP));
    const frontendKeys = new Set(Object.keys(frontendCategoryToGroup));
    const onlyBackend = [...backendKeys].filter((k) => !frontendKeys.has(k));
    const onlyFrontend = [...frontendKeys].filter((k) => !backendKeys.has(k));
    expect({ onlyBackend, onlyFrontend }).toEqual({ onlyBackend: [], onlyFrontend: [] });
  });

  it('has no undocumented divergence for any category both sides define', () => {
    const unexplained: string[] = [];
    for (const [category, backendGroup] of Object.entries(BACKEND_CATEGORY_TO_GROUP)) {
      const frontendGroup = frontendCategoryToGroup[category];
      if (frontendGroup === undefined || frontendGroup === backendGroup) continue;
      const known = KNOWN_INTENTIONAL_DIVERGENCES[category];
      if (known && known.backend === backendGroup && known.frontend === frontendGroup) continue;
      unexplained.push(`${category}: backend='${backendGroup}' frontend='${frontendGroup}'`);
    }
    expect(unexplained, unexplained.join('\n')).toEqual([]);
  });
});
