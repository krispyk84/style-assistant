import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { fragrancesService } from './fragrances.service.js';
import {
  addUserFragranceSchema,
  createManualFragranceSchema,
  fragranceSketchPreviewSchema,
  profileFragranceSchema,
  searchFragrancesSchema,
  updateUserFragranceSchema,
} from './fragrances.validation.js';

export const fragrancesRouter = Router();

// ── Shared catalog ────────────────────────────────────────────────────────────

fragrancesRouter.get(
  '/fragrances/search',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { q } = parseWithSchema(searchFragrancesSchema, request.query);
    const results = await fragrancesService.searchCatalog(q);
    return sendSuccess(response, { fragrances: results });
  })
);

fragrancesRouter.post(
  '/fragrances/profile',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(profileFragranceSchema, request.body);
    const result = await fragrancesService.profileFragrance(payload, request.userId!);
    return sendSuccess(response, result);
  })
);

// No-AI fallback for when recognition failed or the user chose manual entry
// (spec section 17) — creates/reuses a catalog row from user-supplied fields only.
fragrancesRouter.post(
  '/fragrances/manual',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(createManualFragranceSchema, request.body);
    const result = await fragrancesService.createManualFragrance(payload);
    return sendSuccess(response, result, 201);
  })
);

// Must be before /fragrances/sketch-preview/:jobId to avoid ambiguity.
fragrancesRouter.post(
  '/fragrances/sketch-preview',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(fragranceSketchPreviewSchema, request.body);
    const result = await fragrancesService.startSketchPreview(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

fragrancesRouter.get(
  '/fragrances/sketch-preview/:jobId',
  requireAuth,
  asyncHandler(async (request, response) => {
    const jobId = Array.isArray(request.params.jobId) ? request.params.jobId[0] : request.params.jobId;
    if (!jobId) throw new HttpError(400, 'INVALID_REQUEST', 'Job ID is required.');
    const result = await fragrancesService.getSketchPreview(jobId);
    return sendSuccess(response, result);
  })
);

// ── User's closet fragrances ─────────────────────────────────────────────────

fragrancesRouter.post(
  '/closet/fragrances',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(addUserFragranceSchema, request.body);
    const result = await fragrancesService.addToCloset(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

fragrancesRouter.get(
  '/closet/fragrances',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await fragrancesService.listUserFragrances(request.userId!);
    return sendSuccess(response, { fragrances: result });
  })
);

fragrancesRouter.patch(
  '/closet/fragrances/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Fragrance ID is required.');
    const payload = parseWithSchema(updateUserFragranceSchema, request.body);
    const result = await fragrancesService.updateUserFragrance(id, request.userId!, payload);
    return sendSuccess(response, result);
  })
);

fragrancesRouter.delete(
  '/closet/fragrances/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Fragrance ID is required.');
    const result = await fragrancesService.removeUserFragrance(id, request.userId!);
    return sendSuccess(response, result);
  })
);
