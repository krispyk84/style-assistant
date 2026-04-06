import { prisma } from '../../db/prisma.js';

type ClosetItemMetadata = {
  subcategory?: string;
  primaryColor?: string;
  colorFamily?: string;
  material?: string;
  formality?: string;
  silhouette?: string;
  season?: string;
  weight?: string;
  pattern?: string;
  notes?: string;
  fitStatus?: string;
};

export const closetRepository = {
  async createItem(data: {
    supabaseUserId: string;
    title: string;
    brand: string;
    size: string;
    category: string;
    uploadedImageUrl?: string;
    sketchImageUrl?: string;
    sketchStorageKey?: string;
    sketchMimeType?: string;
    sketchImageData?: Buffer;
    sketchStatus: string;
  } & ClosetItemMetadata) {
    return prisma.closetItem.create({ data });
  },

  async getItems(supabaseUserId: string) {
    return prisma.closetItem.findMany({
      where: { supabaseUserId },
      orderBy: { savedAt: 'desc' },
    });
  },

  async getItem(id: string, supabaseUserId: string) {
    return prisma.closetItem.findFirst({ where: { id, supabaseUserId } });
  },

  async updateItem(id: string, supabaseUserId: string, data: {
    title: string;
    brand: string;
    size: string;
    category: string;
  } & ClosetItemMetadata) {
    return prisma.closetItem.updateMany({ where: { id, supabaseUserId }, data });
  },

  async deleteItem(id: string, supabaseUserId: string) {
    return prisma.closetItem.deleteMany({ where: { id, supabaseUserId } });
  },

  async createSketchJob() {
    return prisma.closetSketchJob.create({ data: { status: 'pending' } });
  },

  async getSketchJob(id: string) {
    return prisma.closetSketchJob.findUnique({ where: { id } });
  },

  async updateSketchJob(id: string, data: {
    status: string;
    sketchImageUrl?: string | null;
    sketchStorageKey?: string | null;
    sketchMimeType?: string | null;
    sketchImageData?: Buffer | null;
  }) {
    return prisma.closetSketchJob.update({ where: { id }, data });
  },
};
