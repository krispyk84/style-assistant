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

  async getItems() {
    return prisma.closetItem.findMany({ orderBy: { savedAt: 'desc' } });
  },

  async getItem(id: string) {
    return prisma.closetItem.findUnique({ where: { id } });
  },

  async updateItem(id: string, data: {
    title: string;
    brand: string;
    size: string;
    category: string;
  } & ClosetItemMetadata) {
    return prisma.closetItem.update({ where: { id }, data });
  },

  async deleteItem(id: string) {
    return prisma.closetItem.delete({ where: { id } });
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
