import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  API_PREFIX: z.string().default('/api'),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_RESPONSES_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_IMAGE_MODEL: z.string().min(1).default('gpt-image-1'),
  FAL_API_KEY: z.string().min(1),
  FAL_KEY: z.string().min(1),
  CLOSET_LORA_URL: z.string().url(),
  OUTFIT_LORA_URL: z.string().url(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  STYLE_GUIDE_ENABLED: z.coerce.boolean().default(true),
  STYLE_GUIDE_VECTOR_STORE_ID: z.string().optional(),
  STYLE_GUIDE_SOURCE_PATH: z.string().default('style-guides/source/Esquire-2024.epub'),
  STYLE_GUIDE_MAX_RESULTS: z.coerce.number().int().positive().max(10).default(3),
  STYLE_GUIDE_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_PUBLIC_BASE_URL: z.string().url(),
  STORAGE_LOCAL_DIR: z.string().min(1),
  STORAGE_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(8),
  // S3 / Cloudflare R2 (required when STORAGE_PROVIDER=s3)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().url().optional(),
  AWS_S3_PUBLIC_BASE_URL: z.string().url().optional(),
  // Image generation provider selection
  // 'fal'   → fal.ai Flux-LoRA (current default)
  // 'imagen' → Google Imagen on Vertex AI / AI Studio
  IMAGE_PROVIDER: z.enum(['fal', 'imagen']).default('fal'),
  // Google Imagen config (required when IMAGE_PROVIDER=imagen)
  // IMAGEN_AUTH_TYPE=apikey  → Google AI Studio API key via generativelanguage.googleapis.com
  // IMAGEN_AUTH_TYPE=serviceaccount → Vertex AI OAuth2 Bearer token via aiplatform.googleapis.com
  IMAGEN_AUTH_TYPE: z.enum(['apikey', 'serviceaccount']).default('apikey'),
  IMAGEN_API_KEY: z.string().optional(),         // required when IMAGEN_AUTH_TYPE=apikey
  IMAGEN_ACCESS_TOKEN: z.string().optional(),    // required when IMAGEN_AUTH_TYPE=serviceaccount
  IMAGEN_PROJECT_ID: z.string().optional(),      // required when IMAGEN_AUTH_TYPE=serviceaccount
  IMAGEN_LOCATION: z.string().default('us-central1'),
  IMAGEN_MODEL: z.string().default('imagen-3.0-generate-001'),
});

export const env = envSchema.parse(process.env);
