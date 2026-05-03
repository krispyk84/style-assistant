import { z } from 'zod';

// ── Trend relevance — per-item annotation against uploaded style guides ──────

const trendAnnotationSchema = z.object({
  itemId: z.string(),
  label: z.enum(['on-trend', 'neutral', 'dated']),
  rationale: z.string().max(200),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const trendResponseSchema = z.object({
  styleGuideSummary: z.string(),
  annotations: z.array(trendAnnotationSchema),
  overallScore: z.number().int().min(0).max(100),
  onTrendHighlights: z.array(z.string()).max(3),
  datedCallouts: z.array(z.string()).max(3),
});

export type TrendResponse = z.infer<typeof trendResponseSchema>;
