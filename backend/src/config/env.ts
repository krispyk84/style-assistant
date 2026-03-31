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
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  STYLE_GUIDE_ENABLED: z.coerce.boolean().default(true),
  STYLE_GUIDE_VECTOR_STORE_ID: z.string().optional(),
  STYLE_GUIDE_SOURCE_PATH: z.string().default('style-guides/source/Esquire-2024.epub'),
  STYLE_GUIDE_MAX_RESULTS: z.coerce.number().int().positive().max(10).default(3),
  STYLE_GUIDE_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  STORAGE_PUBLIC_BASE_URL: z.string().url(),
  STORAGE_LOCAL_DIR: z.string().min(1),
  STORAGE_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(8),
});

export const env = envSchema.parse(process.env);
