import { z } from 'zod';

export const uploadedImageCategorySchema = z.enum(['anchor-item', 'candidate-piece', 'selfie']);
