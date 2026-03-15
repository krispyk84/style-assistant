import path from 'node:path';

import { env } from './env.js';

export const storageConfig = {
  provider: env.STORAGE_PROVIDER,
  localDirectory: path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR),
  publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, ''),
  maxFileSizeBytes: env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
} as const;
