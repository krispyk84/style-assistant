import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { outfitChatService } from './outfit-chat.service.js';
import { outfitChatSchema } from './outfit-chat.validation.js';

export const outfitChatRouter = Router();

outfitChatRouter.post(
  '/outfit-chat',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(outfitChatSchema, request.body);
    const result = await outfitChatService.askQuestion(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);
