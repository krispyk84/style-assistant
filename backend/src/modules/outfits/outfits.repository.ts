import { OutfitTier, Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import type { OutfitPieceDto, OutfitResponse, OutfitTierSlug } from '../../contracts/outfits.contracts.js';

/** Serializes a structured piece to a JSON string for DB storage. */
function serializePiece(piece: OutfitPieceDto): string {
  return JSON.stringify(piece);
}

/** Deserializes a DB string back to OutfitPieceDto. Handles legacy plain strings. */
function deserializePiece(s: string): OutfitPieceDto {
  try {
    const parsed: unknown = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && 'display_name' in parsed && typeof (parsed as { display_name: unknown }).display_name === 'string') {
      return parsed as OutfitPieceDto;
    }
  } catch {
    // Not JSON — legacy plain string
  }
  return { display_name: s, metadata: null };
}

function toPrismaTier(tier: OutfitTierSlug): OutfitTier {
  if (tier === 'business') return OutfitTier.BUSINESS;
  if (tier === 'smart-casual') return OutfitTier.SMART_CASUAL;
  return OutfitTier.CASUAL;
}

function toSlug(tier: OutfitTier): OutfitTierSlug {
  if (tier === OutfitTier.BUSINESS) return 'business';
  if (tier === OutfitTier.SMART_CASUAL) return 'smart-casual';
  return 'casual';
}

export const outfitsRepository = {
  async upsertGeneratedOutfit(profileId: string | undefined, output: OutfitResponse) {
    const result = await prisma.$transaction(async (tx) => {
      const db = tx as any;

      await db.outfitRequest.upsert({
        where: { id: output.requestId },
        update: {
          profileId,
          anchorImageId: output.input.anchorImageId,
          anchorItemDescription: output.input.anchorItemDescription,
          anchorImageUrl: output.input.anchorImageUrl,
          photoPending: output.input.photoPending,
          selectedTiers: output.input.selectedTiers.map(toPrismaTier),
          weatherContext: output.input.weatherContext ?? Prisma.JsonNull,
          status: output.status,
        },
        create: {
          id: output.requestId,
          profileId,
          anchorImageId: output.input.anchorImageId,
          anchorItemDescription: output.input.anchorItemDescription,
          anchorImageUrl: output.input.anchorImageUrl,
          photoPending: output.input.photoPending,
          selectedTiers: output.input.selectedTiers.map(toPrismaTier),
          weatherContext: output.input.weatherContext ?? Prisma.JsonNull,
          status: output.status,
        },
      });

      const outfitResult = await db.outfitResult.upsert({
        where: { requestId: output.requestId },
        update: {
          status: output.status,
          provider: output.provider,
          rawResponse: output as unknown as Prisma.JsonObject,
          generatedAt: new Date(output.generatedAt),
        },
        create: {
          requestId: output.requestId,
          status: output.status,
          provider: output.provider,
          rawResponse: output as unknown as Prisma.JsonObject,
          generatedAt: new Date(output.generatedAt),
        },
      });

      for (const recommendation of output.recommendations) {
        await db.tierResult.upsert({
          where: {
            outfitResultId_tier: {
              outfitResultId: outfitResult.id,
              tier: toPrismaTier(recommendation.tier),
            },
          },
          update: {
            title: recommendation.title,
            anchorItem: recommendation.anchorItem,
            keyPieces: recommendation.keyPieces.map(serializePiece),
            shoes: recommendation.shoes.map(serializePiece),
            accessories: recommendation.accessories.map(serializePiece),
            fitNotes: recommendation.fitNotes,
            whyItWorks: recommendation.whyItWorks,
            stylingDirection: recommendation.stylingDirection,
            detailNotes: recommendation.detailNotes,
            sketchStatus: recommendation.sketchStatus,
            sketchImageUrl: recommendation.sketchImageUrl,
            sketchStorageKey: recommendation.sketchStorageKey,
            sketchMimeType: recommendation.sketchMimeType,
            ...(recommendation.sketchImageData
              ? ({ sketchImageData: recommendation.sketchImageData } as any)
              : {}),
            variantIndex: recommendation.variantIndex,
          },
          create: {
            outfitResultId: outfitResult.id,
            tier: toPrismaTier(recommendation.tier),
            title: recommendation.title,
            anchorItem: recommendation.anchorItem,
            keyPieces: recommendation.keyPieces.map(serializePiece),
            shoes: recommendation.shoes.map(serializePiece),
            accessories: recommendation.accessories.map(serializePiece),
            fitNotes: recommendation.fitNotes,
            whyItWorks: recommendation.whyItWorks,
            stylingDirection: recommendation.stylingDirection,
            detailNotes: recommendation.detailNotes,
            sketchStatus: recommendation.sketchStatus,
            sketchImageUrl: recommendation.sketchImageUrl,
            sketchStorageKey: recommendation.sketchStorageKey,
            sketchMimeType: recommendation.sketchMimeType,
            ...(recommendation.sketchImageData
              ? ({ sketchImageData: recommendation.sketchImageData } as any)
              : {}),
            variantIndex: recommendation.variantIndex,
          },
        });
      }

      return outfitResult.id;
    });

    return result;
  },

  async findGeneratedOutfit(requestId: string) {
    const result = await prisma.outfitResult.findUnique({
      where: { requestId },
      include: {
        request: true,
        tierResults: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!result || !result.request) {
      return null;
    }

    const requestRecord = result.request as any;
    const tierResults = result.tierResults as any[];
    const rawResponse = result.rawResponse as any;
    const rawAnchorItems = Array.isArray(rawResponse?.input?.anchorItems) ? rawResponse.input.anchorItems : null;

    const output: OutfitResponse = {
      requestId: result.requestId,
      status: 'completed',
      provider: result.provider === 'openai' ? 'openai' : 'mock',
      generatedAt: result.generatedAt.toISOString(),
      input: {
        anchorItems:
          rawAnchorItems ??
          [
            {
              description: requestRecord.anchorItemDescription,
              imageId: requestRecord.anchorImageId ?? undefined,
              imageUrl: requestRecord.anchorImageUrl ?? undefined,
            },
          ].filter((item) => item.description?.trim() || item.imageId || item.imageUrl),
        anchorItemDescription: rawResponse?.input?.anchorItemDescription ?? requestRecord.anchorItemDescription,
        vibeKeywords: rawResponse?.input?.vibeKeywords ?? undefined,
        anchorImageId: requestRecord.anchorImageId ?? null,
        anchorImageUrl: requestRecord.anchorImageUrl,
        photoPending: requestRecord.photoPending,
        selectedTiers: requestRecord.selectedTiers.map(toSlug),
        weatherContext: requestRecord.weatherContext ?? null,
      },
      recommendations: tierResults.map((tier) => ({
        tier: toSlug(tier.tier),
        title: tier.title,
        anchorItem: tier.anchorItem,
        keyPieces: (tier.keyPieces as string[]).map(deserializePiece),
        shoes: (tier.shoes as string[]).map(deserializePiece),
        accessories: (tier.accessories as string[]).map(deserializePiece),
        fitNotes: tier.fitNotes as string[],
        whyItWorks: tier.whyItWorks,
        stylingDirection: tier.stylingDirection,
        detailNotes: tier.detailNotes as string[],
        sketchStatus:
          tier.sketchStatus === 'ready' || tier.sketchStatus === 'failed' ? tier.sketchStatus : 'pending',
        sketchImageUrl: tier.sketchImageUrl ?? null,
        sketchStorageKey: tier.sketchStorageKey ?? null,
        sketchMimeType: tier.sketchMimeType ?? null,
        sketchImageData: tier.sketchImageData ?? null,
        variantIndex: tier.variantIndex,
      })),
    };

    return output;
  },

  async updateTierSketch(
    requestId: string,
    tier: OutfitTierSlug,
    input: {
      sketchStatus: 'pending' | 'ready' | 'failed';
      sketchImageUrl: string | null;
      sketchStorageKey: string | null;
      sketchMimeType: string | null;
      sketchImageData?: Buffer | null;
    }
  ) {
    const result = await prisma.outfitResult.findUnique({
      where: { requestId },
      select: { id: true },
    });

    if (!result) {
      return;
    }

    await prisma.tierResult.update({
      where: {
        outfitResultId_tier: {
          outfitResultId: result.id,
          tier: toPrismaTier(tier),
        },
      },
      data: {
        sketchStatus: input.sketchStatus,
        sketchImageUrl: input.sketchImageUrl,
        sketchStorageKey: input.sketchStorageKey,
        sketchMimeType: input.sketchMimeType,
        ...(input.sketchImageData !== undefined ? ({ sketchImageData: input.sketchImageData } as any) : {}),
      } as any,
    });
  },

  async findTierSketch(requestId: string, tier: OutfitTierSlug) {
    const result = await prisma.outfitResult.findUnique({
      where: { requestId },
      select: {
        id: true,
      },
    });

    if (!result) {
      return null;
    }

    return prisma.tierResult.findUnique({
      where: {
        outfitResultId_tier: {
          outfitResultId: result.id,
          tier: toPrismaTier(tier),
        },
      },
      select: {
        sketchStatus: true,
        sketchImageUrl: true,
        sketchStorageKey: true,
        sketchMimeType: true,
        sketchImageData: true,
      } as any,
    }) as Promise<{
      sketchStatus: string;
      sketchImageUrl: string | null;
      sketchStorageKey: string | null;
      sketchMimeType: string | null;
      sketchImageData?: Buffer | null;
    } | null>;
  },
};
