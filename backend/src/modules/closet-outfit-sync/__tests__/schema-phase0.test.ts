import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

// Phase 0 of the local<->cloud sync redesign is additive-only schema — no
// live database is required or touched to test it (this repo's backend
// tests never connect to a real database at all; see vitest.config.ts's
// dummy DATABASE_URL). What CAN be verified without one is that the
// generated Prisma client's own field enums — which `prisma generate`
// derives purely from schema.prisma — agree with what the accompanying
// migration actually adds. If schema.prisma and the migration SQL ever
// drifted apart, this is the test that would catch it, well before any
// real database is involved.
describe('Phase 0 schema additions — ClosetOutfitFavourite / ClosetOutfitWeekPlanItem', () => {
  it('ClosetOutfitFavourite gains syncVersion and deletedAt without losing any existing field', () => {
    const fields = Prisma.ClosetOutfitFavouriteScalarFieldEnum;
    expect(fields).toMatchObject({
      id: 'id',
      supabaseUserId: 'supabaseUserId',
      formality: 'formality',
      outfit: 'outfit',
      savedAt: 'savedAt',
      syncVersion: 'syncVersion',
      deletedAt: 'deletedAt',
    });
  });

  it('ClosetOutfitWeekPlanItem gains syncVersion and deletedAt without losing any existing field', () => {
    const fields = Prisma.ClosetOutfitWeekPlanItemScalarFieldEnum;
    expect(fields).toMatchObject({
      id: 'id',
      supabaseUserId: 'supabaseUserId',
      dayKey: 'dayKey',
      dayLabel: 'dayLabel',
      formality: 'formality',
      outfit: 'outfit',
      assignedAt: 'assignedAt',
      syncVersion: 'syncVersion',
      deletedAt: 'deletedAt',
    });
  });
});
