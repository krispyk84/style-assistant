import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { storageConfig } from '../config/storage.js';
import type { StorageProvider } from './storage-provider.js';

function extensionFromFilename(filename?: string) {
  if (!filename) {
    return '';
  }

  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : '';
}

export const localStorageProvider: StorageProvider = {
  async storeFile(input) {
    await fs.mkdir(storageConfig.localDirectory, { recursive: true });

    const extension = extensionFromFilename(input.originalFilename);
    const storageKey = `${input.category}/${crypto.randomUUID()}${extension}`;
    const destinationPath = path.join(storageConfig.localDirectory, storageKey);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.rename(input.tempFilePath, destinationPath);

    return {
      storageProvider: 'local',
      storageKey,
      publicUrl: `${storageConfig.publicBaseUrl}/media/${storageKey}`,
    };
  },

  async deleteFile(storageKey) {
    const filePath = path.join(storageConfig.localDirectory, storageKey);
    await fs.rm(filePath, { force: true });
  },
};
