import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetService } from './closet.service.js';
import {
  analyzeClosetItemSchema,
  closetMatchSchema,
  generateClosetSketchSchema,
  saveClosetItemSchema,
  updateClosetItemSchema,
} from './closet.validation.js';

export const closetRouter = Router();

// Stateless AI operations — auth required but no userId scoping needed in the service
closetRouter.post(
  '/closet/match',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(closetMatchSchema, request.body);
    const result = await closetService.matchItems(payload);
    return sendSuccess(response, result);
  })
);

closetRouter.post(
  '/closet/items/analyze',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(analyzeClosetItemSchema, request.body);
    const result = await closetService.analyzeItem(payload);
    return sendSuccess(response, result);
  })
);

// Must be before /closet/items/:id to avoid "sketch-preview" being treated as an id
closetRouter.post(
  '/closet/items/sketch-preview',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateClosetSketchSchema, request.body);
    const result = await closetService.generateItemSketch(payload);
    return sendSuccess(response, result, 201);
  })
);

closetRouter.get(
  '/closet/items/sketch-preview/:jobId',
  requireAuth,
  asyncHandler(async (request, response) => {
    const jobId = Array.isArray(request.params.jobId) ? request.params.jobId[0] : request.params.jobId;
    if (!jobId) throw new HttpError(400, 'INVALID_REQUEST', 'Job ID is required.');
    const result = await closetService.getItemSketch(jobId);
    return sendSuccess(response, result);
  })
);

closetRouter.post(
  '/closet/items',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(saveClosetItemSchema, request.body);
    const result = await closetService.saveItem(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

closetRouter.get(
  '/closet/items',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await closetService.getItems(request.userId!);
    return sendSuccess(response, result);
  })
);

closetRouter.get(
  '/closet/items/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Item ID is required.');
    const result = await closetService.getItem(id, request.userId!);
    return sendSuccess(response, result);
  })
);

closetRouter.patch(
  '/closet/items/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Item ID is required.');
    const payload = parseWithSchema(updateClosetItemSchema, request.body);
    const result = await closetService.updateItem(id, request.userId!, payload);
    return sendSuccess(response, result);
  })
);

closetRouter.delete(
  '/closet/items/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Item ID is required.');
    const result = await closetService.deleteItem(id, request.userId!);
    return sendSuccess(response, result);
  })
);
