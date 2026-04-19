import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { tripsService } from './trips.service.js';
import { generateTripOutfitsSchema, generateTripDaySketchSchema, regenerateTripDaySchema } from './trips.schemas.js';

export const tripsRouter = Router();

const MAX_TRIP_DAYS = 8;

function tripLengthDays(departureDate: string, returnDate: string): number {
  const dep = new Date(departureDate);
  const ret = new Date(returnDate);
  return Math.round((ret.getTime() - dep.getTime()) / 86_400_000) + 1;
}

tripsRouter.post(
  '/trips/generate',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateTripOutfitsSchema, request.body);
    const numDays = tripLengthDays(payload.departureDate, payload.returnDate);
    if (numDays > MAX_TRIP_DAYS) {
      throw new HttpError(400, `Trips can be up to ${MAX_TRIP_DAYS} days long right now.`);
    }
    const result = await tripsService.generateTripOutfits(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

tripsRouter.post(
  '/trips/regenerate-day',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(regenerateTripDaySchema, request.body);
    const day = await tripsService.regenerateDay(payload, request.userId!);
    return sendSuccess(response, { day });
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
