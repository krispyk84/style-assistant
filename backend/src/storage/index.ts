import { localStorageProvider } from './local-storage-provider.js';
import type { StorageProvider } from './storage-provider.js';

export const storageProvider: StorageProvider = localStorageProvider;
