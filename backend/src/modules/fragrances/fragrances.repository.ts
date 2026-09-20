import type { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

// JSON-typed fields (topNotes, mainAccords, seasonality, etc.) use `undefined`
// for "no value" rather than `null` — Prisma's generated types require the
// Prisma.JsonNull sentinel for an explicit JSON null, which these repository
// functions have no reason to ever write; omitting the field (undefined) is
// both simpler and what every call site actually means ("not provided").
export type FragranceCreateInput = {
  brand: string;
  name: string;
  concentration?: string | null;
  normalizedBrand: string;
  normalizedName: string;
  canonicalKey: string;
  topNotes?: string[];
  middleNotes?: string[];
  baseNotes?: string[];
  mainAccords?: { name: string; weight: number }[];
  primaryVibe?: string | null;
  secondaryVibes?: string[];
  seasonality?: Record<string, number>;
  dayNight?: Record<string, number>;
  formality?: Record<string, number>;
  profileSource: 'llm' | 'manual';
  profileModel?: string | null;
  profileVersion?: string | null;
  profileConfidence?: number | null;
};

export type UserFragranceCreateInput = {
  supabaseUserId: string;
  fragranceId: string;
  originalImageUrl?: string | null;
  bottleSketchUrl?: string | null;
  bottleSketchStatus?: string;
  isSignature?: boolean;
  currentVolumeMl?: number | null;
  userNotes?: string | null;
  profileOverrides?: Prisma.InputJsonValue;
};

export type UserFragranceUpdateInput = {
  isSignature?: boolean;
  currentVolumeMl?: number | null;
  userNotes?: string | null;
  profileOverrides?: Prisma.InputJsonValue;
  bottleSketchUrl?: string | null;
  bottleSketchStatus?: string;
};

export const fragrancesRepository = {
  async findByCanonicalKey(canonicalKey: string) {
    return prisma.fragrance.findUnique({ where: { canonicalKey } });
  },

  async findById(id: string) {
    return prisma.fragrance.findUnique({ where: { id } });
  },

  async createFragrance(data: FragranceCreateInput) {
    return prisma.fragrance.create({ data });
  },

  /** Simple case-insensitive substring search over brand/name — the catalog is expected to stay small relative to a full-text-search use case. */
  async searchCatalog(query: string, limit = 20) {
    return prisma.fragrance.findMany({
      where: {
        OR: [
          { brand: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { brand: 'asc' },
    });
  },

  async createUserFragrance(data: UserFragranceCreateInput) {
    return prisma.userFragrance.create({ data, include: { fragrance: true } });
  },

  async getUserFragrance(id: string, supabaseUserId: string) {
    return prisma.userFragrance.findFirst({ where: { id, supabaseUserId }, include: { fragrance: true } });
  },

  /** Ownership-scoped in the WHERE clause, not a separate check — matches closet.repository.ts's convention. */
  async listUserFragrances(supabaseUserId: string) {
    return prisma.userFragrance.findMany({
      where: { supabaseUserId },
      include: { fragrance: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateUserFragrance(id: string, supabaseUserId: string, data: UserFragranceUpdateInput) {
    return prisma.userFragrance.updateMany({ where: { id, supabaseUserId }, data });
  },

  async deleteUserFragrance(id: string, supabaseUserId: string) {
    return prisma.userFragrance.deleteMany({ where: { id, supabaseUserId } });
  },

  async findExistingOwnership(supabaseUserId: string, fragranceId: string) {
    return prisma.userFragrance.findUnique({
      where: { supabaseUserId_fragranceId: { supabaseUserId, fragranceId } },
      include: { fragrance: true },
    });
  },
};
