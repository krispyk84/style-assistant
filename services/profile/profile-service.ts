import type { ApiResponse, ProfileSessionResponse, ProfileUpsertRequest } from '@/types/api';

export type ProfileService = {
  loadSession: () => Promise<ApiResponse<ProfileSessionResponse>>;
  saveProfile: (request: ProfileUpsertRequest) => Promise<ApiResponse<ProfileSessionResponse>>;
};
