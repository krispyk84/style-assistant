import { env } from '../config/env.js';
import { localStorageProvider } from './local-storage-provider.js';
import { s3StorageProvider } from './s3-storage-provider.js';
import type { StorageProvider } from './storage-provider.js';

export const storageProvider: StorageProvider =
  env.STORAGE_PROVIDER === 's3' ? s3StorageProvider : localStorageProvider;
