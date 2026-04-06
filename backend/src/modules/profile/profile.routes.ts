import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { profileService } from './profile.service.js';
import { upsertProfileSchema } from './profile.validation.js';

export const profileRouter = Router();

profileRouter.get(
  '/profile',
  requireAuth,
  asyncHandler(async (request, response) => {
    const profile = await profileService.getProfile(request.userId!);
    return sendSuccess(response, profile);
  })
);

profileRouter.post(
  '/profile',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(upsertProfileSchema, request.body);
    const profile = await profileService.upsertProfile(request.userId!, payload);
    return sendSuccess(response, profile, 201);
  })
);
