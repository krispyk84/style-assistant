import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import multer from 'multer';
import { Router } from 'express';

import { storageConfig } from '../../config/storage.js';
import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { extractItinerarySchema } from './trip-itinerary.validation.js';
import { tripItineraryService } from './trip-itinerary.service.js';
import { uploadsService } from '../uploads/uploads.service.js';

const tempUploadDir = path.join(os.tmpdir(), 'style-assistant-uploads');
void fs.mkdir(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  },
  fileFilter: (_request: unknown, file: { mimetype: string }, callback: (error: Error | null, acceptFile?: boolean) => void) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Only PDF itineraries are supported.'));
      return;
    }

    callback(null, true);
  },
});

export const tripItineraryRouter = Router();

// Extracts a day-by-day breakdown from an uploaded itinerary PDF, filtered
// to the overlap with this trip's own destination/dates. The uploaded PDF
// is never persisted — read once for extraction and deleted in the finally
// block below regardless of outcome (mirrors stylist-brief.routes.ts's own
// temp-file cleanup pattern).
tripItineraryRouter.post(
  '/trip-itinerary/extract',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'FILE_REQUIRED', 'An itinerary PDF is required.');
    }

    try {
      const { destination, departureDate, returnDate } = parseWithSchema(extractItinerarySchema, request.body);
      const result = await tripItineraryService.extractItineraryDays({
        filePath: request.file.path,
        destination,
        departureDate,
        returnDate,
        supabaseUserId: request.userId!,
      });

      return sendSuccess(response, result);
    } finally {
      await uploadsService.cleanupTempFile(request.file?.path);
    }
  })
);
