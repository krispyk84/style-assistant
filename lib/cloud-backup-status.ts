import { createApiClient } from '@/lib/api/api-client';

export type CloudBackupStatus = {
  savedOutfitsInCloud: number;
  closetItemsInCloud: number;
  weekPlanInCloud: number;
  closetOutfitFavouritesInCloud: number;
  closetOutfitWeekPlanInCloud: number;
};

export async function fetchCloudBackupStatus(): Promise<CloudBackupStatus | null> {
  const response = await createApiClient().request<CloudBackupStatus>('/diagnostics/cloud-backup-status');
  if (!response.success || !response.data) return null;
  return response.data;
}
