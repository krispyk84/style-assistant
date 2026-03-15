import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import multer from 'multer';
import { Router } from 'express';

import { storageConfig } from '../../config/storage.js';
import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { uploadsService } from './uploads.service.js';
import { uploadedImageCategorySchema } from './uploads.validation.js';

const tempUploadDir = path.join(os.tmpdir(), 'style-assistant-uploads');
void fs.mkdir(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  },
  fileFilter: (_request: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile?: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Only image uploads are allowed.'));
      return;
    }

    callback(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  '/uploads',
  upload.single('file'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'FILE_REQUIRED', 'A file is required.');
    }

    try {
      const category = parseWithSchema(uploadedImageCategorySchema, request.body.category);
      const width = request.body.width ? Number(request.body.width) : undefined;
      const height = request.body.height ? Number(request.body.height) : undefined;

      const result = await uploadsService.createUpload({
        category,
        file: request.file,
        width,
        height,
      });

      return sendSuccess(response, result, 201);
    } finally {
      await uploadsService.cleanupTempFile(request.file?.path);
    }
  })
);

uploadsRouter.delete(
  '/uploads/:id',
  asyncHandler(async (request, response) => {
    const uploadId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    await uploadsService.deleteUpload(uploadId);
    return sendSuccess(response, { deleted: true });
  })
);
