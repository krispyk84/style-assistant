import { prisma } from '../../db/prisma.js';

export type ClosetAnalysisSnapshot = {
  id: string;
  supabaseUserId: string;
  closetHash: string;
  itemCount: number;
  totalScore: number;
  subScores: {
    formality_range: number;
    color_versatility: number;
    seasonal_coverage: number;
    layering_options: number;
    occasion_coverage: number;
  };
  summary: string;
  deficientCategory: string;
  excessCategory: string;
  itemSignatures: string[];
  createdAt: Date;
};

function toDomain(row: {
  id: string;
  supabaseUserId: string;
  closetHash: string;
  itemCount: number;
  totalScore: number;
  formalityRange: number;
  colorVersatility: number;
  seasonalCoverage: number;
  layeringOptions: number;
  occasionCoverage: number;
  summary: string;
  deficientCategory: string;
  excessCategory: string;
  itemSignatures: string[];
  createdAt: Date;
}): ClosetAnalysisSnapshot {
  return {
    id: row.id,
    supabaseUserId: row.supabaseUserId,
    closetHash: row.closetHash,
    itemCount: row.itemCount,
    totalScore: row.totalScore,
    subScores: {
      formality_range: row.formalityRange,
      color_versatility: row.colorVersatility,
      seasonal_coverage: row.seasonalCoverage,
      layering_options: row.layeringOptions,
      occasion_coverage: row.occasionCoverage,
    },
    summary: row.summary,
    deficientCategory: row.deficientCategory,
    excessCategory: row.excessCategory,
    itemSignatures: row.itemSignatures,
    createdAt: row.createdAt,
  };
}

export const closetAnalysisRepository = {
  async findLatest(supabaseUserId: string): Promise<ClosetAnalysisSnapshot | null> {
    const row = await prisma.closetAnalysisSnapshot.findFirst({
      where: { supabaseUserId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  },

  async create(input: Omit<ClosetAnalysisSnapshot, 'id' | 'createdAt'>): Promise<ClosetAnalysisSnapshot> {
    const row = await prisma.closetAnalysisSnapshot.create({
      data: {
        supabaseUserId: input.supabaseUserId,
        closetHash: input.closetHash,
        itemCount: input.itemCount,
        totalScore: input.totalScore,
        formalityRange: input.subScores.formality_range,
        colorVersatility: input.subScores.color_versatility,
        seasonalCoverage: input.subScores.seasonal_coverage,
        layeringOptions: input.subScores.layering_options,
        occasionCoverage: input.subScores.occasion_coverage,
        summary: input.summary,
        deficientCategory: input.deficientCategory,
        excessCategory: input.excessCategory,
        itemSignatures: input.itemSignatures,
      },
    });
    return toDomain(row);
  },
};
