import { prisma } from '../../db/prisma.js';
import type { UpsertProfileRequest } from '../../contracts/profile.contracts.js';

export const profileRepository = {
  async findById(id: string) {
    return prisma.userProfile.findUnique({
      where: { id },
    });
  },

  async findLatest() {
    return prisma.userProfile.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
    });
  },

  async upsertLatest(input: UpsertProfileRequest) {
    const existing = await prisma.userProfile.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!existing) {
      return prisma.userProfile.create({
        data: {
          ...input,
          notes: input.notes ?? null,
        },
      });
    }

    return prisma.userProfile.update({
      where: { id: existing.id },
      data: {
        ...input,
        notes: input.notes ?? null,
      },
    });
  },
};
