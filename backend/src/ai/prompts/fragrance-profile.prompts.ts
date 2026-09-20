import { z } from 'zod';

import type { JsonSchemaConfig } from '../openai-request-builder.js';
import { FRAGRANCE_CONCENTRATION_OPTIONS, FRAGRANCE_VIBE_OPTIONS, type FragranceVibe } from '../../modules/fragrances/fragrance-types.js';

export { FRAGRANCE_CONCENTRATION_OPTIONS, FRAGRANCE_VIBE_OPTIONS, type FragranceVibe };

// ── Structured fragrance profiling ───────────────────────────────────────────
//
// A single INGESTION-time structured call (createStructuredResponse — the
// same primitive every other structured AI call in this app uses, no new
// provider). Called at most once per distinct fragrance: fragrances.service.ts
// checks the Fragrance catalog by canonicalKey FIRST and only reaches this
// prompt on a catalog miss. This is never called at outfit-recommendation
// runtime — the deterministic recommender (fragrance-recommendation.service.ts)
// only ever reads already-persisted Fragrance rows.

const seasonalitySchema = z.object({
  spring: z.number().min(0).max(1),
  summer: z.number().min(0).max(1),
  fall: z.number().min(0).max(1),
  winter: z.number().min(0).max(1),
});

const dayNightSchema = z.object({
  day: z.number().min(0).max(1),
  night: z.number().min(0).max(1),
});

const formalitySchema = z.object({
  casual: z.number().min(0).max(1),
  smartCasual: z.number().min(0).max(1),
  business: z.number().min(0).max(1),
  formalEvening: z.number().min(0).max(1),
});

export const fragranceProfileResponseSchema = z.object({
  recognized: z.boolean(),
  canonicalBrand: z.string().nullable().optional(),
  canonicalName: z.string().nullable().optional(),
  concentration: z.enum(FRAGRANCE_CONCENTRATION_OPTIONS).nullable().optional(),
  topNotes: z.array(z.string()).max(8).nullable().optional(),
  middleNotes: z.array(z.string()).max(8).nullable().optional(),
  baseNotes: z.array(z.string()).max(8).nullable().optional(),
  mainAccords: z.array(z.object({ name: z.string(), weight: z.number().min(0).max(1) })).max(8).nullable().optional(),
  primaryVibe: z.enum(FRAGRANCE_VIBE_OPTIONS).nullable().optional(),
  secondaryVibes: z.array(z.enum(FRAGRANCE_VIBE_OPTIONS)).max(3).nullable().optional(),
  seasonality: seasonalitySchema.nullable().optional(),
  dayNight: dayNightSchema.nullable().optional(),
  formality: formalitySchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export type FragranceProfileResponse = z.infer<typeof fragranceProfileResponseSchema>;

const INSTRUCTIONS = [
  'You are a fragrance identification and profiling expert. Given either a photo of a fragrance bottle, a brand/name/concentration provided by the user, or both, identify the fragrance and return a structured profile.',
  'Do not invent fragrances. If you do not confidently recognize the specific fragrance, return recognized=false and omit (null) every content field except confidence — do not guess a plausible-sounding profile.',
  'Distinguish similarly named flankers (e.g. "Bleu de Chanel" vs "Bleu de Chanel Parfum") as different fragrances — do not conflate them.',
  'Distinguish Eau de Toilette / Eau de Parfum / Parfum / Extrait when the concentration is knowable — use "Unknown" rather than guessing if it genuinely is not.',
  `If uncertain about a specific note, omit it from topNotes/middleNotes/baseNotes rather than fabricating one — an incomplete but accurate note list is far better than a complete but invented one.`,
  `Use ONLY this fixed vibe taxonomy for primaryVibe/secondaryVibes: ${FRAGRANCE_VIBE_OPTIONS.join(', ')}. Never invent a vibe outside this list.`,
  'seasonality/dayNight/formality are Vesture-internal INFERRED suitability scores from 0.0 (poor fit) to 1.0 (excellent fit) based on the fragrance\'s actual composition and character — they are NOT community vote percentages, NOT sales data, and NOT a claim about how any review site or community rates this fragrance. Do not present them as anything other than your own inferred judgment.',
  'Do not generate marketing copy, brand history, or long prose anywhere in the response. Every field is short, factual, structured data.',
  'Prefer uncertainty over false precision: a lower confidence score with recognized=true is fine when you have genuine but partial certainty about the specific fragrance; recognized=false is for when you cannot identify the fragrance at all.',
  'Return only structured JSON matching the schema.',
].join(' ');

type FragranceProfileContentBlock =
  | { type: 'input_image'; image_url: string; detail: 'high' }
  | { type: 'input_text'; text: string };

export function buildFragranceProfilePrompt(input: {
  brand?: string | null;
  name?: string | null;
  concentration?: string | null;
  imageBlock?: { type: 'input_image'; image_url: string; detail: 'high' } | null;
}): {
  instructions: string;
  userContent: FragranceProfileContentBlock[];
  jsonSchema: JsonSchemaConfig;
} {
  const userContent: FragranceProfileContentBlock[] = [];
  if (input.imageBlock) userContent.push(input.imageBlock);

  const textParts: string[] = [];
  if (input.brand?.trim()) textParts.push(`Brand: ${input.brand.trim()}`);
  if (input.name?.trim()) textParts.push(`Fragrance name: ${input.name.trim()}`);
  if (input.concentration?.trim()) textParts.push(`Concentration: ${input.concentration.trim()}`);
  userContent.push({
    type: 'input_text',
    text: textParts.length > 0
      ? `Identify and profile this fragrance. User-provided details: ${textParts.join('; ')}.${input.imageBlock ? ' A photo is also attached — use it to confirm or refine identification.' : ''}`
      : 'Identify and profile the fragrance shown in the attached photo.',
  });

  return {
    instructions: INSTRUCTIONS,
    userContent,
    jsonSchema: {
      name: 'fragrance_profile',
      description: 'Structured identity and scent profile for a fragrance',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recognized: { type: 'boolean' },
          canonicalBrand: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          canonicalName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          concentration: { anyOf: [{ type: 'string', enum: [...FRAGRANCE_CONCENTRATION_OPTIONS] }, { type: 'null' }] },
          topNotes: { anyOf: [{ type: 'array', items: { type: 'string' }, maxItems: 8 }, { type: 'null' }] },
          middleNotes: { anyOf: [{ type: 'array', items: { type: 'string' }, maxItems: 8 }, { type: 'null' }] },
          baseNotes: { anyOf: [{ type: 'array', items: { type: 'string' }, maxItems: 8 }, { type: 'null' }] },
          mainAccords: {
            anyOf: [
              {
                type: 'array',
                maxItems: 8,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: { name: { type: 'string' }, weight: { type: 'number', description: '0.0 to 1.0' } },
                  required: ['name', 'weight'],
                },
              },
              { type: 'null' },
            ],
          },
          primaryVibe: { anyOf: [{ type: 'string', enum: [...FRAGRANCE_VIBE_OPTIONS] }, { type: 'null' }] },
          secondaryVibes: { anyOf: [{ type: 'array', items: { type: 'string', enum: [...FRAGRANCE_VIBE_OPTIONS] }, maxItems: 3 }, { type: 'null' }] },
          seasonality: {
            anyOf: [
              {
                type: 'object', additionalProperties: false,
                properties: {
                  spring: { type: 'number' }, summer: { type: 'number' }, fall: { type: 'number' }, winter: { type: 'number' },
                },
                required: ['spring', 'summer', 'fall', 'winter'],
              },
              { type: 'null' },
            ],
          },
          dayNight: {
            anyOf: [
              {
                type: 'object', additionalProperties: false,
                properties: { day: { type: 'number' }, night: { type: 'number' } },
                required: ['day', 'night'],
              },
              { type: 'null' },
            ],
          },
          formality: {
            anyOf: [
              {
                type: 'object', additionalProperties: false,
                properties: {
                  casual: { type: 'number' }, smartCasual: { type: 'number' }, business: { type: 'number' }, formalEvening: { type: 'number' },
                },
                required: ['casual', 'smartCasual', 'business', 'formalEvening'],
              },
              { type: 'null' },
            ],
          },
          confidence: { type: 'number', description: '0.0 to 1.0' },
        },
        required: [
          'recognized', 'canonicalBrand', 'canonicalName', 'concentration', 'topNotes', 'middleNotes', 'baseNotes',
          'mainAccords', 'primaryVibe', 'secondaryVibes', 'seasonality', 'dayNight', 'formality', 'confidence',
        ],
      },
    },
  };
}
