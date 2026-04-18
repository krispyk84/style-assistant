import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { savedTripsService } from './saved-trips.service.js';
import { saveTripSchema } from './saved-trips.schemas.js';

export const savedTripsRouter = Router();

savedTripsRouter.post(
  '/trips/saved',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(saveTripSchema, request.body);
    const result = await savedTripsService.upsert(payload, request.userId!);
    return sendSuccess(response, result, 200);
  }),
);

savedTripsRouter.get(
  '/trips/saved',
  requireAuth,
  asyncHandler(async (request, response) => {
    const trips = await savedTripsService.list(request.userId!);
    return sendSuccess(response, { trips });
  }),
);

savedTripsRouter.get(
  '/trips/saved/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0]! : request.params.id!;
    const trip = await savedTripsService.getById(id, request.userId!);
    return sendSuccess(response, trip);
  }),
);

savedTripsRouter.delete(
  '/trips/saved/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0]! : request.params.id!;
    await savedTripsService.delete(id, request.userId!);
    return sendSuccess(response, null, 204);
  }),
);
