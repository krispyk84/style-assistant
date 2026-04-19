import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { tripPlansService } from './trip-plans.service.js';

export const tripPlansRouter = Router();

const MAX_TRIP_DAYS = 8;

// ── Validation schemas ────────────────────────────────────────────────────────

const createTripPlanSchema = z.object({
  destination:    z.string().min(1),
  country:        z.string().min(1),
  departureDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelParty:    z.string().min(1),
  purposes:       z.array(z.string()).default([]),
  climateLabel:   z.string().min(1),
  styleVibe:      z.string().min(1),
  willSwim:       z.boolean(),
  fancyNights:    z.boolean(),
  workoutClothes: z.boolean(),
  laundryAccess:  z.string().min(1),
  shoesCount:     z.string().min(1),
  carryOnOnly:    z.boolean(),
  activities:     z.string().optional(),
  dressCode:      z.string().optional(),
  specialNeeds:   z.string().optional(),
  anchorMode:     z.enum(['guided', 'auto', 'manual']).optional(),
});

const tripAnchorSchema = z.object({
  slotId:         z.string().optional(),
  label:          z.string().min(1),
  category:       z.string().min(1),
  source:         z.enum(['closet', 'camera', 'library', 'ai_suggested']),
  closetItemId:   z.string().optional(),
  uploadedImageId: z.string().optional(),
  imageUrl:       z.string().optional(),
  rationale:      z.string().optional(),
  position:       z.number().optional(),
});

const setAnchorsSchema = z.object({
  anchorMode: z.enum(['guided', 'auto', 'manual']),
  anchors:    z.array(tripAnchorSchema),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** POST /trips/plan — create trip plan draft */
tripPlansRouter.post(
  '/trips/plan',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = parseWithSchema(createTripPlanSchema, req.body);

    const dep = new Date(payload.departureDate);
    const ret = new Date(payload.returnDate);
    const numDays = Math.round((ret.getTime() - dep.getTime()) / 86_400_000) + 1;

    if (numDays > MAX_TRIP_DAYS) {
      throw new HttpError(400, `Trips can be up to ${MAX_TRIP_DAYS} days long right now.`);
    }

    const plan = await tripPlansService.createPlan({
      supabaseUserId: req.userId!,
      numDays,
      ...payload,
    });

    return sendSuccess(res, { id: plan.id }, 201);
  })
);

/** GET /trips/plan/:id — fetch plan with anchors */
tripPlansRouter.get(
  '/trips/plan/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const plan = await tripPlansService.getPlan(req.params.id!, req.userId!);
    if (!plan) throw new HttpError(404, 'Trip plan not found.');
    return sendSuccess(res, plan);
  })
);

/** PATCH /trips/plan/:id/anchors — replace anchor list */
tripPlansRouter.patch(
  '/trips/plan/:id/anchors',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { anchorMode, anchors } = parseWithSchema(setAnchorsSchema, req.body);
    const plan = await tripPlansService.getPlan(req.params.id!, req.userId!);
    if (!plan) throw new HttpError(404, 'Trip plan not found.');
    const updated = await tripPlansService.setAnchors(req.params.id!, req.userId!, anchorMode, anchors);
    return sendSuccess(res, updated);
  })
);
