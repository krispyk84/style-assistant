import { prisma } from '../../db/prisma.js';
import type { HaircutStyle } from '../../ai/prompts/haircut.prompts.js';

export const haircutRepository = {
  async createSession(input: { supabaseUserId: string; headshotImageUrl: string; hemisphere?: string; region?: string; fashionGender?: string }) {
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

  // Unsaved sessions beyond the retention limit — each carries up to ~20
  // HaircutOption rows with real JPEG blobs, so these are worth pruning
  // aggressively. Saved sessions (savedAt set) are never candidates here at
  // all — the where-clause excludes them outright, not just via ordering.
  async findUnsavedSessionIdsBeyondLimit(supabaseUserId: string, keep: number) {
    const sessions = await prisma.haircutSession.findMany({
      where: { supabaseUserId, savedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: keep,
      select: { id: true },
    });
    return sessions.map((session) => session.id);
  },

  // onDelete: Cascade on HaircutOption.session means this also removes every
  // option row (and its image blob) belonging to these sessions.
  async deleteSessionsByIds(ids: string[]) {
    if (ids.length === 0) return 0;
    const result = await prisma.haircutSession.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  },

  /**
   * Angle-shot options (styleKey contains "::", e.g. "textured-quiff::top")
   * stuck pending/failed for longer than the given cutoff — covers
   * generation orphaned by a server restart (in-flight work only ever lived
   * in memory) as well as genuine failures. Includes the parent session's
   * other options so the caller can find the "front" option to rebuild the
   * generation input from.
   */
  async findStuckAngleOptions(olderThan: Date) {
    return prisma.haircutOption.findMany({
      where: {
        status: { in: ['pending', 'failed'] },
        styleKey: { contains: '::' },
        createdAt: { lt: olderThan },
      },
      include: { session: { include: { options: true } } },
    });
  },
};
