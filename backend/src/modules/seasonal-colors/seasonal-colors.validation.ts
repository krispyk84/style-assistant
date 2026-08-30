import { z } from 'zod';

export const ensureSeasonalColorsSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']),
  region: z.string().trim().min(1).max(200).optional(),
});

export const getSeasonalColorsReportSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  hemisphere: z.enum(['northern', 'southern']).default('northern'),
});

export const setColorFeedbackSchema = z.object({
  fashionGender: z.enum(['menswear', 'womenswear']),
  colorName: z.string().trim().min(1).max(200),
  feedback: z.enum(['up', 'down']).nullable(),
});
