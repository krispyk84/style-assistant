export type StoreFileInput = {
  category: string;
  tempFilePath: string;
  originalFilename?: string;
  mimeType?: string;
};

export type StoreGeneratedFileInput = {
  category: string;
  fileExtension: string;
  mimeType?: string;
  data: Uint8Array | Buffer;
};

export type StoredFile = {
  storageProvider: string;
  storageKey: string;
  publicUrl: string;
};

export type StorageProvider = {
  storeFile: (input: StoreFileInput) => Promise<StoredFile>;
  storeGeneratedFile: (input: StoreGeneratedFileInput) => Promise<StoredFile>;
  deleteFile: (storageKey: string) => Promise<void>;
};
