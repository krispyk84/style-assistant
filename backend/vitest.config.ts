import { defineConfig } from 'vitest/config';

// Dummy values for env vars that config/env.ts requires at import time
// (zod schema.parse with no defaults) — tests never make real network/DB
// calls against these; anything that would is mocked at the module level.
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      OPENAI_API_KEY: 'test-openai-key',
      STORAGE_PUBLIC_BASE_URL: 'http://localhost:4000',
      STORAGE_LOCAL_DIR: '/tmp/style-assistant-test-storage',
    },
  },
});
