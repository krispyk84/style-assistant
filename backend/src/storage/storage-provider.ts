import type { UploadedImageCategory } from '../contracts/uploads.contracts.js';

export type StoreFileInput = {
  category: UploadedImageCategory;
  tempFilePath: string;
  originalFilename?: string;
  mimeType?: string;
};

export type StoredFile = {
  storageProvider: string;
  storageKey: string;
  publicUrl: string;
};

export type StorageProvider = {
  storeFile: (input: StoreFileInput) => Promise<StoredFile>;
  deleteFile: (storageKey: string) => Promise<void>;
};
