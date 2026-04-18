import { z } from 'zod';

const savedTripDaySchema = z.object({
  id:           z.string().min(1),
  tripId:       z.string().min(1),
  dayIndex:     z.number().int().min(0),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title:        z.string().min(1),
  dayType:      z.string().min(1),
  rationale:    z.string().min(1),
  pieces:       z.array(z.string().min(1)),
  shoes:        z.string().min(1),
  bag:          z.string().nullable(),
  accessories:  z.array(z.string()),
  contextTags:  z.array(z.string()),
  sketchStatus: z.string().optional(),
  sketchUrl:    z.string().optional(),
  sketchJobId:  z.string().optional(),
  feedback:     z.enum(['love', 'hate']).nullable().optional(),
});

export const saveTripSchema = z.object({
  tripId:       z.string().min(1),
  destination:  z.string().min(1),
  country:      z.string().min(1),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelParty:  z.string().min(1),
  climateLabel: z.string().min(1),
  styleVibe:    z.string().min(1),
  purposes:     z.array(z.string()).default([]),
  activities:   z.string().optional(),
  dressCode:    z.string().optional(),
  days:         z.array(savedTripDaySchema).min(1),
});
