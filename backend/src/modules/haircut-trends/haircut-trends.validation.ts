import { z } from 'zod';

export const ensureHaircutTrendsSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']),
  region: z.string().trim().min(1).max(200).optional(),
});

export const getHaircutTrendsSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']).default('northern'),
});
