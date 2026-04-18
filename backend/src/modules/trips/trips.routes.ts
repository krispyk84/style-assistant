import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { tripsService } from './trips.service.js';
import { generateTripOutfitsSchema, generateTripDaySketchSchema } from './trips.schemas.js';

export const tripsRouter = Router();

tripsRouter.post(
  '/trips/generate',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateTripOutfitsSchema, request.body);
    const result = await tripsService.generateTripOutfits(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

tripsRouter.post(
  '/trips/sketch-day',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateTripDaySketchSchema, request.body);
    const jobId = await tripsService.startDaySketchJob({
      ...payload,
      supabaseUserId: request.userId!,
    });
    return sendSuccess(response, { jobId }, 202);
  })
);

tripsRouter.get(
  '/trips/sketch-day/:jobId',
  requireAuth,
  asyncHandler(async (request, response) => {
    const jobId = Array.isArray(request.params.jobId)
      ? request.params.jobId[0]!
      : request.params.jobId!;
    const result = await tripsService.getDaySketchStatus(jobId);
    return sendSuccess(response, result);
  })
);
