import { z } from 'zod';

export const ensureHaircutTrendsSchema = z.object({
  hemisphere: z.enum(['northern', 'southern']),
  region: z.string().trim().min(1).max(200).optional(),
});

export const getHaircutTrendsSchema = z.object({
  hemisphere: z.enum(['northern', 'southern']).default('northern'),
});
