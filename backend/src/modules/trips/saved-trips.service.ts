import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import type { SaveTripRequest, SavedTripDetailDto, SavedTripSummaryDto } from '../../contracts/saved-trips.contracts.js';

function toSummary(row: {
  id: string;
  tripId: string;
  destination: string;
  country: string;
  departureDate: string;
  returnDate: string;
  travelParty: string;
  climateLabel: string;
  styleVibe: string;
  purposes: unknown;
  activities: string | null;
  dressCode: string | null;
  days: unknown;
  savedAt: Date;
  updatedAt: Date;
}): SavedTripSummaryDto {
  const days = Array.isArray(row.days) ? row.days : [];
  return {
    id: row.id,
    tripId: row.tripId,
    destination: row.destination,
    country: row.country,
    departureDate: row.departureDate,
    returnDate: row.returnDate,
    travelParty: row.travelParty,
    climateLabel: row.climateLabel,
    styleVibe: row.styleVibe,
    purposes: Array.isArray(row.purposes) ? (row.purposes as string[]) : [],
    activities: row.activities ?? undefined,
    dressCode: row.dressCode ?? undefined,
    dayCount: days.length,
    savedAt: row.savedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const savedTripsService = {
  async upsert(payload: SaveTripRequest, supabaseUserId: string): Promise<SavedTripDetailDto> {
    const row = await prisma.savedTrip.upsert({
      where: {
        supabaseUserId_tripId: { supabaseUserId, tripId: payload.tripId },
      },
      create: {
        supabaseUserId,
        tripId:       payload.tripId,
        destination:  payload.destination,
        country:      payload.country,
        departureDate: payload.departureDate,
        returnDate:   payload.returnDate,
        travelParty:  payload.travelParty,
        climateLabel: payload.climateLabel,
        styleVibe:    payload.styleVibe,
        purposes:     payload.purposes,
        activities:   payload.activities ?? null,
        dressCode:    payload.dressCode ?? null,
        days:         payload.days as object[],
      },
      update: {
        destination:  payload.destination,
        country:      payload.country,
        departureDate: payload.departureDate,
        returnDate:   payload.returnDate,
        travelParty:  payload.travelParty,
        climateLabel: payload.climateLabel,
        styleVibe:    payload.styleVibe,
        purposes:     payload.purposes,
        activities:   payload.activities ?? null,
        dressCode:    payload.dressCode ?? null,
        days:         payload.days as object[],
      },
    });

    return {
      ...toSummary(row),
      days: Array.isArray(row.days) ? (row.days as SavedTripDetailDto['days']) : [],
    };
  },

  async list(supabaseUserId: string): Promise<SavedTripSummaryDto[]> {
    const rows = await prisma.savedTrip.findMany({
      where: { supabaseUserId },
      orderBy: { savedAt: 'desc' },
    });
    return rows.map(toSummary);
  },

  async getById(id: string, supabaseUserId: string): Promise<SavedTripDetailDto> {
    const row = await prisma.savedTrip.findUnique({ where: { id } });
    if (!row || row.supabaseUserId !== supabaseUserId) {
      throw new HttpError(404, 'NOT_FOUND', 'Saved trip not found.');
    }
    return {
      ...toSummary(row),
      days: Array.isArray(row.days) ? (row.days as SavedTripDetailDto['days']) : [],
    };
  },

  async delete(id: string, supabaseUserId: string): Promise<void> {
    const row = await prisma.savedTrip.findUnique({ where: { id } });
    if (!row || row.supabaseUserId !== supabaseUserId) {
      throw new HttpError(404, 'NOT_FOUND', 'Saved trip not found.');
    }
    await prisma.savedTrip.delete({ where: { id } });
  },
};
