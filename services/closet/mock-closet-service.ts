import { deleteClosetItem, loadClosetItems, saveClosetItem, updateClosetItem } from '@/lib/closet-storage';
import type {
  AnalyzeClosetItemRequest,
  AnalyzeClosetItemResponse,
  ApiResponse,
  ClosetAnalyseResponse,
  ClosetMatchRequest,
  ClosetMatchResponse,
  GenerateClosetSketchRequest,
  GenerateClosetSketchResponse,
  GetClosetItemsResponse,
  GetClosetSketchResponse,
  HelpMePickRequest,
  HelpMePickResponse,
  SaveClosetItemRequest,
  UpdateClosetItemRequest,
} from '@/types/api';
import type { ClosetItem, ClosetItemFitStatus, ClosetItemSilhouette } from '@/types/closet';
import type { ClosetService } from '@/services/closet/closet-service';

const MOCK_CATEGORIES: Record<string, string> = {
  suit: 'Suit',
  blazer: 'Blazer',
  jacket: 'Sports Jacket',
  coat: 'Coat',
  shirt: 'Shirt',
  'polo': 'Polo',
  sweater: 'Knitwear',
  cardigan: 'Cardigan',
  hoodie: 'Hoodie',
  trouser: 'Trousers',
  pant: 'Trousers',
  jean: 'Denim',
  short: 'Shorts',
  shoe: 'Shoes',
  sneaker: 'Sneakers',
  loafer: 'Loafers',
  boot: 'Boots',
  belt: 'Belt',
  bag: 'Bag',
  watch: 'Watch',
  scarf: 'Scarf',
  hat: 'Hat',
  tie: 'Tie',
  sock: 'Socks',
};

function guessCategoryFromDescription(description: string): string {
  const lower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(MOCK_CATEGORIES)) {
    if (lower.includes(keyword)) {
      return category;
    }
  }
  return 'Clothing';
}

function guessTitleFromDescription(description: string): string {
  if (!description.trim()) {
    return 'Wardrobe Piece';
  }
  const words = description.trim().split(/\s+/).slice(0, 6);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const mockClosetService: ClosetService = {
  async analyzeItem(request: AnalyzeClosetItemRequest): Promise<ApiResponse<AnalyzeClosetItemResponse>> {
    const description = request.description ?? '';
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      success: true,
      data: {
        title: guessTitleFromDescription(description),
        category: guessCategoryFromDescription(description),
      },
      error: null,
    };
  },

  async saveItem(request: SaveClosetItemRequest): Promise<ApiResponse<ClosetItem>> {
    const item: ClosetItem = {
      id: `mock-${Date.now()}`,
      title: request.title,
      brand: request.brand,
      size: request.size,
      category: request.category,
      uploadedImageUrl: request.uploadedImageUrl ?? null,
      sketchImageUrl: null,
      sketchStatus: 'failed',
      savedAt: new Date().toISOString(),
      subcategory: request.subcategory,
      primaryColor: request.primaryColor,
      colorFamily: request.colorFamily as ClosetItem['colorFamily'],
      material: request.material,
      formality: request.formality,
      silhouette: request.silhouette as ClosetItemSilhouette | undefined,
      season: request.season,
      weight: request.weight,
      pattern: request.pattern,
      notes: request.notes,
      fitStatus: request.fitStatus as ClosetItemFitStatus | undefined,
    };
    await saveClosetItem(item);
    return { success: true, data: item, error: null };
  },

  async getItems(): Promise<ApiResponse<GetClosetItemsResponse>> {
    const items = await loadClosetItems();
    return { success: true, data: { items }, error: null };
  },

  async getItem(id: string): Promise<ApiResponse<ClosetItem>> {
    const items = await loadClosetItems();
    const item = items.find((i) => i.id === id) ?? null;
    if (!item) {
      return { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Item not found.' } };
    }
    return { success: true, data: item, error: null };
  },

  async updateItem(request: UpdateClosetItemRequest): Promise<ApiResponse<ClosetItem>> {
    const items = await loadClosetItems();
    const existing = items.find((i) => i.id === request.id);
    if (!existing) {
      return { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Item not found.' } };
    }
    const updated: ClosetItem = {
      ...existing,
      title: request.title ?? existing.title,
      brand: request.brand ?? existing.brand,
      size: request.size ?? existing.size,
      category: request.category ?? existing.category,
      uploadedImageUrl: request.uploadedImageUrl ?? existing.uploadedImageUrl,
      sketchImageUrl: request.sketchImageUrl ?? existing.sketchImageUrl,
      subcategory: request.subcategory ?? existing.subcategory,
      primaryColor: request.primaryColor ?? existing.primaryColor,
      colorFamily: (request.colorFamily ?? existing.colorFamily) as ClosetItem['colorFamily'],
      material: request.material ?? existing.material,
      formality: request.formality ?? existing.formality,
      silhouette: (request.silhouette ?? existing.silhouette) as ClosetItemSilhouette | undefined,
      season: request.season ?? existing.season,
      weight: request.weight ?? existing.weight,
      pattern: request.pattern ?? existing.pattern,
      notes: request.notes ?? existing.notes,
      fitStatus: (request.fitStatus ?? existing.fitStatus) as ClosetItemFitStatus | undefined,
    };
    await updateClosetItem(updated);
    return { success: true, data: updated, error: null };
  },

  async deleteItem(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    await deleteClosetItem(id);
    return { success: true, data: { deleted: true }, error: null };
  },

  async generateItemSketch(_request: GenerateClosetSketchRequest): Promise<ApiResponse<GenerateClosetSketchResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Sketch generation is not available right now.' },
    };
  },

  async getItemSketch(_jobId: string): Promise<ApiResponse<GetClosetSketchResponse>> {
    return {
      success: true,
      data: { sketchStatus: 'failed', sketchImageUrl: null },
      error: null,
    };
  },

  async matchItems(request: ClosetMatchRequest): Promise<ApiResponse<ClosetMatchResponse>> {
    return {
      success: true,
      data: {
        matches: request.suggestions.map((suggestion, i) => ({
          suggestionIndex: i,
          suggestion: suggestion.display_name,
          matchedItemId: null,
        })),
      },
      error: null,
    };
  },

  async helpMePick(_request: HelpMePickRequest): Promise<ApiResponse<HelpMePickResponse>> {
    return {
      success: false,
      data: null,
      error: { code: 'UNAVAILABLE', message: 'Help Me Pick is not available right now.' },
    };
  },

  async recordAnchorUsed(_id: string): Promise<ApiResponse<{ recorded: boolean }>> {
    return { success: true, data: { recorded: true }, error: null };
  },

  async recordMatchUsed(_id: string): Promise<ApiResponse<{ recorded: boolean }>> {
    return { success: true, data: { recorded: true }, error: null };
  },

  async analyseCloset(): Promise<ApiResponse<ClosetAnalyseResponse>> {
    return { success: false, data: null, error: { code: 'UNAVAILABLE', message: 'Closet analysis is not available right now.' } };
  },
};
