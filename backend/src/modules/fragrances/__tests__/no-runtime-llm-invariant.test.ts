import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';

// ── Static proof of the "zero runtime LLM dependency" invariant ─────────────
//
// The deterministic recommender (fragrance-recommendation.service.ts) must
// NEVER import anything from ai/ or any *.service.ts that itself touches
// openai-client.ts — profiling and sketch generation only ever happen once,
// at ingestion. This test makes that invariant mechanically checkable rather
// than relying on code review alone: it greps the pure module's own import
// statements and fails if any of them reach into the AI layer.

const __dirname = dirname(fileURLToPath(import.meta.url));
const PURE_MODULE_PATH = join(__dirname, '../fragrance-recommendation.service.ts');
const INTEGRATION_MODULE_PATH = join(__dirname, '../fragrance-recommendation-integration.ts');

function importSpecifiers(source: string): string[] {
  const matches = [...source.matchAll(/^import\s+.*?from\s+['"](.+?)['"];?\s*$/gm)];
  return matches.map((m) => m[1]!);
}

describe('fragrance-recommendation.service.ts — no-runtime-LLM invariant', () => {
  const source = readFileSync(PURE_MODULE_PATH, 'utf8');
  const specifiers = importSpecifiers(source);

  it('imports nothing from the ai/ layer', () => {
    for (const specifier of specifiers) {
      expect(specifier.includes('/ai/')).toBe(false);
    }
  });

  it('imports nothing that touches openai-client.ts', () => {
    for (const specifier of specifiers) {
      expect(specifier).not.toContain('openai-client');
    }
  });

  it('imports nothing from Prisma or a database client', () => {
    for (const specifier of specifiers) {
      expect(specifier).not.toContain('@prisma/client');
      expect(specifier.includes('/db/')).toBe(false);
    }
  });

  it('only imports local types (relative paths) — no external network/DB packages', () => {
    for (const specifier of specifiers) {
      expect(specifier.startsWith('.')).toBe(true);
    }
  });
});

describe('fragrance-recommendation-integration.ts — calls only the pure scorer + repository', () => {
  const source = readFileSync(INTEGRATION_MODULE_PATH, 'utf8');
  const specifiers = importSpecifiers(source);

  it('never imports directly from ai/ (all AI calls happen at ingestion, in a different module)', () => {
    for (const specifier of specifiers) {
      expect(specifier.includes('/ai/')).toBe(false);
    }
  });
});
