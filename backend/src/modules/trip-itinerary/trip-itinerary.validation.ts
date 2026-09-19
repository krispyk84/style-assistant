import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const extractItinerarySchema = z.object({
  destination: z.string().trim().min(1),
  departureDate: isoDate,
  returnDate: isoDate,
});
