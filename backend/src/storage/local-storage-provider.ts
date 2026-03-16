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

function normalizeExtension(fileExtension: string) {
  return fileExtension.startsWith('.') ? fileExtension.toLowerCase() : `.${fileExtension.toLowerCase()}`;
}

export const localStorageProvider: StorageProvider = {
  async storeFile(input) {
    await fs.mkdir(storageConfig.localDirectory, { recursive: true });

    const extension = extensionFromFilename(input.originalFilename);
    const storageKey = `${input.category}/${crypto.randomUUID()}${extension}`;
    const destinationPath = path.join(storageConfig.localDirectory, storageKey);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    try {
      await fs.rename(input.tempFilePath, destinationPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      // Render stores multipart temp files under /tmp, which can be a different
      // device from the app filesystem. Fall back to copy+delete in that case.
      await fs.copyFile(input.tempFilePath, destinationPath);
      await fs.rm(input.tempFilePath, { force: true });
    }

    return {
      storageProvider: 'local',
      storageKey,
      publicUrl: `${storageConfig.publicBaseUrl}/media/${storageKey}`,
    };
  },

  async storeGeneratedFile(input) {
    await fs.mkdir(storageConfig.localDirectory, { recursive: true });

    const storageKey = `${input.category}/${crypto.randomUUID()}${normalizeExtension(input.fileExtension)}`;
    const destinationPath = path.join(storageConfig.localDirectory, storageKey);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, input.data);

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
