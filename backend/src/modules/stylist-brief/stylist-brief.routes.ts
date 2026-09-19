import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import multer from 'multer';
import { Router } from 'express';

import { storageConfig } from '../../config/storage.js';
import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { stylistBriefService } from './stylist-brief.service.js';
import { uploadsService } from '../uploads/uploads.service.js';

const tempUploadDir = path.join(os.tmpdir(), 'style-assistant-uploads');
void fs.mkdir(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  },
  fileFilter: (_request: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile?: boolean) => void) => {
    if (!file.mimetype.startsWith('audio/')) {
      callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Only audio recordings are allowed.'));
      return;
    }

    callback(null, true);
  },
});

export const stylistBriefRouter = Router();

// Transcribes a spoken stylist brief. The uploaded recording is never
// persisted — it's read once for transcription and deleted in the finally
// block below regardless of outcome (mirrors uploads.routes.ts's own
// temp-file cleanup pattern).
stylistBriefRouter.post(
  '/stylist-brief/transcribe',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'FILE_REQUIRED', 'A recording is required.');
    }

    try {
      const text = await stylistBriefService.transcribe({
        filePath: request.file.path,
        originalFilename: request.file.originalname,
        mimetype: request.file.mimetype,
        supabaseUserId: request.userId!,
      });

      return sendSuccess(response, { text });
    } finally {
      await uploadsService.cleanupTempFile(request.file?.path);
    }
  })
);
