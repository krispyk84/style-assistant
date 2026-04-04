import { deleteClosetItem, loadClosetItems, saveClosetItem, updateClosetItem } from '@/lib/closet-storage';
import type {
  AnalyzeClosetItemRequest,
  AnalyzeClosetItemResponse,
  ClosetMatchRequest,
  ClosetMatchResponse,
  GenerateClosetSketchRequest,
  GenerateClosetSketchResponse,
  GetClosetItemsResponse,
  GetClosetSketchResponse,
  SaveClosetItemRequest,
  UpdateClosetItemRequest,
} from '@/types/api';
import type { ApiResponse } from '@/types/api';
import type { ClosetItem } from '@/types/closet';
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
      fitStatus: request.fitStatus,
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
    const updated: ClosetItem = { ...existing, title: request.title, brand: request.brand, size: request.size, category: request.category, fitStatus: request.fitStatus ?? existing.fitStatus };
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
          suggestion,
          matchedItemId: null,
        })),
      },
      error: null,
    };
  },
};
