import { prisma } from '../../db/prisma.js';
import type { UpsertProfileRequest } from '../../contracts/profile.contracts.js';

export const profileRepository = {
  async findById(id: string) {
    return prisma.userProfile.findUnique({ where: { id } });
  },

  async findByUserId(supabaseUserId: string) {
    return prisma.userProfile.findFirst({ where: { supabaseUserId } });
  },

  async upsertByUserId(supabaseUserId: string, input: UpsertProfileRequest) {
    const existing = await prisma.userProfile.findFirst({ where: { supabaseUserId } });
    if (!existing) {
      // Lazy migration: claim an orphaned profile (pre-auth record with null supabaseUserId)
      // instead of creating a duplicate. Safe because the app was single-user before auth.
      const orphaned = await prisma.userProfile.findFirst({ where: { supabaseUserId: null } });
      if (orphaned) {
        return prisma.userProfile.update({
          where: { id: orphaned.id },
          data: { ...input, supabaseUserId, notes: input.notes ?? null },
        });
      }
      return prisma.userProfile.create({
        data: { ...input, supabaseUserId, notes: input.notes ?? null },
      });
    }
    return prisma.userProfile.update({
      where: { id: existing.id },
      data: { ...input, notes: input.notes ?? null },
    });
  },
};
