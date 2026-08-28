import { prisma } from '../../db/prisma.js';
import type { HaircutStyle } from '../../ai/prompts/haircut.prompts.js';

export const haircutRepository = {
  async createSession(input: { supabaseUserId: string; headshotImageUrl: string }) {
    return prisma.haircutSession.create({ data: input });
  },

  // Returns only the rows just created for this call (scoped by styleKey), not
  // every option in the session — callers that need the full set already have
  // it (getSession) or can concatenate themselves.
  async createOptions(sessionId: string, styles: HaircutStyle[]) {
    await prisma.haircutOption.createMany({
      data: styles.map((style) => ({
        sessionId,
        styleKey: style.key,
        styleLabel: style.label,
        styleSummary: style.summary,
      })),
    });
    return prisma.haircutOption.findMany({
      where: { sessionId, styleKey: { in: styles.map((style) => style.key) } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getSession(id: string, supabaseUserId: string) {
    return prisma.haircutSession.findFirst({
      where: { id, supabaseUserId },
      include: { options: { orderBy: { createdAt: 'asc' } } },
    });
  },

  async updateOption(
    id: string,
    data: {
      status: string;
      imageStorageKey?: string | null;
      imageMimeType?: string | null;
      imageData?: Buffer | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return prisma.haircutOption.update({ where: { id }, data });
  },

  // updateMany (not update) so the supabaseUserId ownership check is baked into
  // the query itself — the caller checks the resulting count rather than a
  // separate findFirst-then-update round trip.
  async saveSession(id: string, supabaseUserId: string, data: { chosenOptionId: string; guideData: object }) {
    return prisma.haircutSession.updateMany({
      where: { id, supabaseUserId },
      data: { chosenOptionId: data.chosenOptionId, guideData: data.guideData, savedAt: new Date() },
    });
  },

  // Only clears savedAt — chosenOptionId/guideData are harmless leftovers once
  // unsaved (listSavedSessions filters on savedAt, so they're never surfaced).
  async unsaveSession(id: string, supabaseUserId: string) {
    return prisma.haircutSession.updateMany({
      where: { id, supabaseUserId },
      data: { savedAt: null },
    });
  },

  async listSavedSessions(supabaseUserId: string) {
    return prisma.haircutSession.findMany({
      where: { supabaseUserId, savedAt: { not: null } },
      include: { options: { orderBy: { createdAt: 'asc' } } },
      orderBy: { savedAt: 'desc' },
    });
  },
};
