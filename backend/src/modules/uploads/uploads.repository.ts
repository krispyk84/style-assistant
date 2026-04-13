import { prisma } from '../../db/prisma.js';
import type { UploadedImageDto, UploadedImageCategory as UploadedImageCategorySlug } from '../../contracts/uploads.contracts.js';

function toPrismaCategory(category: UploadedImageCategorySlug) {
  if (category === 'anchor-item') return 'ANCHOR_ITEM';
  if (category === 'candidate-piece') return 'CANDIDATE_PIECE';
  return 'SELFIE';
}

function toCategory(category: string): UploadedImageCategorySlug {
  if (category === 'ANCHOR_ITEM') return 'anchor-item';
  if (category === 'CANDIDATE_PIECE') return 'candidate-piece';
  return 'selfie';
}

function toDto(image: any): UploadedImageDto {
  return {
    id: image.id,
    category: toCategory(image.category),
    storageProvider: image.storageProvider,
    storageKey: image.storageKey,
    publicUrl: image.publicUrl,
    originalFilename: image.originalFilename,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt.toISOString(),
  };
}

export const uploadsRepository = {
  async create(input: {
    category: UploadedImageCategorySlug;
    storageProvider: string;
    storageKey: string;
    publicUrl: string;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    imageData?: Buffer;
  }) {
    const db = prisma as any;
    const image = await db.uploadedImage.create({
      data: {
        category: toPrismaCategory(input.category),
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        publicUrl: input.publicUrl,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        imageData: input.imageData ?? null,
      },
    });

    return toDto(image);
  },

  async findById(id: string) {
    const db = prisma as any;
    return db.uploadedImage.findUnique({ where: { id } });
  },

  async deleteById(id: string) {
    const db = prisma as any;
    return db.uploadedImage.delete({ where: { id } });
  },
};
