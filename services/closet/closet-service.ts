import type {
  AnalyzeClosetItemRequest,
  AnalyzeClosetItemResponse,
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
import type { ApiResponse } from '@/types/api';
import type { ClosetItem } from '@/types/closet';

export type ClosetService = {
  analyzeItem: (request: AnalyzeClosetItemRequest) => Promise<ApiResponse<AnalyzeClosetItemResponse>>;
  saveItem: (request: SaveClosetItemRequest) => Promise<ApiResponse<ClosetItem>>;
  getItems: () => Promise<ApiResponse<GetClosetItemsResponse>>;
  getItem: (id: string) => Promise<ApiResponse<ClosetItem>>;
  updateItem: (request: UpdateClosetItemRequest) => Promise<ApiResponse<ClosetItem>>;
  deleteItem: (id: string) => Promise<ApiResponse<{ deleted: boolean }>>;
  generateItemSketch: (request: GenerateClosetSketchRequest) => Promise<ApiResponse<GenerateClosetSketchResponse>>;
  getItemSketch: (jobId: string) => Promise<ApiResponse<GetClosetSketchResponse>>;
  matchItems: (request: ClosetMatchRequest) => Promise<ApiResponse<ClosetMatchResponse>>;
  helpMePick: (request: HelpMePickRequest) => Promise<ApiResponse<HelpMePickResponse>>;
  recordAnchorUsed: (id: string) => Promise<ApiResponse<{ recorded: boolean }>>;
};
