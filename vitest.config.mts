import { defineConfig } from 'vitest/config';

// Frontend test config — separate from backend/vitest.config.ts (its own
// package.json, its own test command). Defaults to the 'node' environment
// since most of what's worth unit-testing here is plain logic; individual
// hook-rendering test files opt into jsdom themselves via a
// `// @vitest-environment jsdom` pragma at the top of the file, so the
// (much slower) DOM environment is only paid for where it's actually needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  test: {
    environment: 'node',
    // Scoped to actual project source dirs, not a blanket "**/__tests__/**"
    // — this repo has a node_modules.nosync/ alongside node_modules/ (an
    // iCloud-sync-avoidance convention, see root tsconfig.json's exclude),
    // and several vendored packages ship their own __tests__ directories
    // that a broader glob would otherwise pick up and try to run.
    include: [
      'app/**/__tests__/**/*.test.{ts,tsx}',
      'lib/**/__tests__/**/*.test.{ts,tsx}',
      'hooks/**/__tests__/**/*.test.{ts,tsx}',
      'components/**/__tests__/**/*.test.{ts,tsx}',
      'contexts/**/__tests__/**/*.test.{ts,tsx}',
      'services/**/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: ['backend/**', 'node_modules/**', 'node_modules.nosync/**', 'ios/**', 'android/**'],
  },
});
