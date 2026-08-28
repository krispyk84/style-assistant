import { z } from 'zod';

export const haircutGuideResponseSchema = z.object({
  theLook: z.string(),
  whatToAskFor: z.array(z.string()).min(1).max(5),
  cutDetails: z.array(z.string()).min(1).max(5),
  stylingTips: z.array(z.string()).min(1).max(5),
  whatToAvoid: z.array(z.string()).min(1).max(4),
  maintenance: z.string(),
  products: z.array(z.string()).min(1).max(4),
});

export const HAIRCUT_GUIDE_JSON_SCHEMA = {
  name: 'haircut_guide_response',
  schema: {
    type: 'object' as const,
    properties: {
      theLook: { type: 'string', description: 'One or two sentences describing the overall look and feel' },
      whatToAskFor: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Short, specific phrases to say to a barber' },
      cutDetails: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Short technical details of the cut' },
      stylingTips: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Short at-home styling steps, in order' },
      whatToAvoid: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4, description: 'Short common mistakes or requests to avoid' },
      maintenance: { type: 'string', description: 'One short sentence on trim frequency and upkeep' },
      products: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4, description: 'Short product-type recommendations, not brand names' },
    },
    required: ['theLook', 'whatToAskFor', 'cutDetails', 'stylingTips', 'whatToAvoid', 'maintenance', 'products'],
    additionalProperties: false,
  },
  strict: true,
};
