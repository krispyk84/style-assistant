import { z } from 'zod';

export const ensureSeasonalTrendsSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']),
  region: z.string().trim().min(1).max(200).optional(),
});
export type EnsureSeasonalTrendsPayload = z.infer<typeof ensureSeasonalTrendsSchema>;

export const getSeasonalTrendsReportSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']).default('northern'),
});
