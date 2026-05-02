// ─────────────────────────────────────────────────────────────────────────────
// Trend relevance prompt — JSON schema for the per-item analysis call.
// The instructions + user text are built per-request in trend-relevance.service.ts
// because they embed live style guide content + the item list.
// ─────────────────────────────────────────────────────────────────────────────

export const TREND_RELEVANCE_JSON_SCHEMA = {
  name: 'trend_relevance_analysis',
  description: 'Per-item trend relevance analysis against uploaded style guides',
  schema: {
    type: 'object',
    properties: {
      styleGuideSummary: { type: 'string', description: '2-sentence summary of the style guide aesthetic direction' },
      annotations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            itemId:     { type: 'string' },
            label:      { type: 'string', enum: ['on-trend', 'neutral', 'dated'] },
            rationale:  { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['itemId', 'label', 'rationale', 'confidence'],
          additionalProperties: false,
        },
      },
      overallScore:       { type: 'integer', minimum: 0, maximum: 100 },
      onTrendHighlights:  { type: 'array', items: { type: 'string' } },
      datedCallouts:      { type: 'array', items: { type: 'string' } },
    },
    required: ['styleGuideSummary', 'annotations', 'overallScore', 'onTrendHighlights', 'datedCallouts'],
    additionalProperties: false,
  },
};
