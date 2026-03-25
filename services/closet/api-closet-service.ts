import { createApiClient } from '@/lib/api/api-client';
import { deleteClosetItem, saveClosetItem, updateClosetItem } from '@/lib/closet-storage';
import type {
  AnalyzeClosetItemRequest,
  AnalyzeClosetItemResponse,
  GetClosetItemsResponse,
  SaveClosetItemRequest,
  UpdateClosetItemRequest,
} from '@/types/api';
import type { ApiResponse } from '@/types/api';
import type { ClosetItem } from '@/types/closet';
import { mockClosetService } from '@/services/closet/mock-closet-service';
import type { ClosetService } from '@/services/closet/closet-service';

export const apiClosetService: ClosetService = {
  async analyzeItem(request: AnalyzeClosetItemRequest): Promise<ApiResponse<AnalyzeClosetItemResponse>> {
    const response = await createApiClient().request<AnalyzeClosetItemResponse>('/closet/items/analyze', {
      method: 'POST',
      body: request,
    });
    if (!response.success) {
      return mockClosetService.analyzeItem(request);
    }
    return response;
  },

  async saveItem(request: SaveClosetItemRequest): Promise<ApiResponse<ClosetItem>> {
    const response = await createApiClient().request<ClosetItem>('/closet/items', {
      method: 'POST',
      body: request,
    });
    if (response.success && response.data) {
      await saveClosetItem(response.data);
      return response;
    }
    return mockClosetService.saveItem(request);
  },

  async getItems(): Promise<ApiResponse<GetClosetItemsResponse>> {
    const response = await createApiClient().request<GetClosetItemsResponse>('/closet/items');
    if (!response.success) {
      return mockClosetService.getItems();
    }
    return response;
  },

  async getItem(id: string): Promise<ApiResponse<ClosetItem>> {
    const response = await createApiClient().request<ClosetItem>(`/closet/items/${id}`);
    if (response.success && response.data) {
      await updateClosetItem(response.data);
    }
    return response;
  },

  async updateItem(request: UpdateClosetItemRequest): Promise<ApiResponse<ClosetItem>> {
    const response = await createApiClient().request<ClosetItem>(`/closet/items/${request.id}`, {
      method: 'PATCH',
      body: request,
    });
    if (response.success && response.data) {
      await updateClosetItem(response.data);
      return response;
    }
    return mockClosetService.updateItem(request);
  },

  async deleteItem(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const response = await createApiClient().request<{ deleted: boolean }>(`/closet/items/${id}`, {
      method: 'DELETE',
    });
    if (response.success) {
      await deleteClosetItem(id);
      return response;
    }
    return mockClosetService.deleteItem(id);
  },
};
