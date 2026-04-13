import { promises as fs } from 'node:fs';

import { HttpError } from '../../lib/http-error.js';
import { uploadsRepository } from './uploads.repository.js';
import { storageProvider } from '../../storage/index.js';
import type { UploadedImageCategory } from '../../contracts/uploads.contracts.js';

export const uploadsService = {
  async createUpload(input: {
    category: UploadedImageCategory;
    file: Express.MulterFile;
    width?: number;
    height?: number;
  }) {
    // Read image data BEFORE storeFile() — storeFile uses fs.rename which moves the temp file.
    const imageData = await fs.readFile(input.file.path);

    const storedFile = await storageProvider.storeFile({
      category: input.category,
      tempFilePath: input.file.path,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
    });

    return uploadsRepository.create({
      category: input.category,
      storageProvider: storedFile.storageProvider,
      storageKey: storedFile.storageKey,
      publicUrl: storedFile.publicUrl,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      width: input.width,
      height: input.height,
      imageData,
    });
  },

  async deleteUpload(id: string) {
    const image = await uploadsRepository.findById(id);

    if (!image) {
      throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'Uploaded image not found.');
    }

    await storageProvider.deleteFile(image.storageKey);
    await uploadsRepository.deleteById(id);
  },

  async cleanupTempFile(filePath?: string) {
    if (!filePath) return;
    await fs.rm(filePath, { force: true });
  },
};
