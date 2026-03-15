import { ZodError, type ZodTypeAny } from 'zod';

import { HttpError } from './http-error.js';

export function parseWithSchema<TSchema extends ZodTypeAny>(schema: TSchema, input: unknown) {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed.', error.flatten());
    }

    throw error;
  }
}
