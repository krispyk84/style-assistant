import { z } from 'zod';

export const tripDaySchema = z.object({
  dayIndex:    z.number().int().min(0),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title:       z.string().min(1),
  dayType:     z.enum(['travel_day', 'sightseeing', 'business', 'meeting', 'dinner_out', 'beach_pool', 'adventure', 'wedding_event', 'relaxed', 'conference']),
  rationale:   z.string().min(1),
  pieces:      z.array(z.string().min(1)).min(2).max(5),
  shoes:       z.string().min(1),
  bag:         z.string().nullable(),
  accessories: z.array(z.string().min(1)).max(3),
  contextTags: z.array(z.string().min(1)).min(1).max(4),
});

export const tripOutfitsResponseSchema = z.object({
  days: z.array(tripDaySchema).min(1).max(14),
});

export const generateTripOutfitsSchema = z.object({
  tripId:       z.string().min(1),
  profileId:    z.string().optional(),
  destination:  z.string().min(1),
  country:      z.string().min(1),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelParty:  z.string().min(1),
  purposes:     z.array(z.string()).default([]),
  climateLabel: z.string().min(1),
  avgHighC:     z.number().optional(),
  avgLowC:      z.number().optional(),
  tempBand:     z.string().optional(),
  precipChar:   z.string().optional(),
  packingTag:   z.string().optional(),
  dressSeason:  z.string().optional(),
  activities:   z.string().optional(),
  dressCode:    z.string().optional(),
  styleVibe:    z.string().min(1),
  willSwim:     z.boolean(),
  fancyNights:  z.boolean(),
  workoutClothes: z.boolean(),
  laundryAccess: z.enum(['Yes', 'No', 'Unsure']),
  shoesCount:   z.string().min(1),
  carryOnOnly:  z.boolean(),
  specialNeeds: z.string().optional(),
});

export const generateTripDaySketchSchema = z.object({
  destination:  z.string().min(1),
  dayTitle:     z.string().min(1),
  climateLabel: z.string().default(''),   // optional — empty string is fine
  pieces:       z.array(z.string().min(1)).min(1),
  shoes:        z.string().min(1),
  accessories:  z.array(z.string()).default([]),
  profileId:    z.string().optional(),
});

export const regenerateTripDaySchema = z.object({
  tripId:        z.string().min(1),
  dayIndex:      z.number().int().min(0),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType:       z.enum(['travel_day', 'sightseeing', 'business', 'meeting', 'dinner_out', 'beach_pool', 'adventure', 'wedding_event', 'relaxed', 'conference']),
  destination:   z.string().min(1),
  country:       z.string().min(1),
  climateLabel:  z.string().default(''),
  activities:    z.string().optional(),
  dressCode:     z.string().optional(),
  styleVibe:     z.string().min(1),
  purposes:      z.array(z.string()).default([]),
  previousPieces: z.array(z.string()).default([]),
  previousShoes:  z.string().optional(),
  profileId:     z.string().optional(),
});
