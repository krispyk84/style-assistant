import { createApiClient } from '@/lib/api/api-client';

export type CloudBackupStatus = {
  savedOutfitsInCloud: number;
  closetItemsInCloud: number;
  weekPlanInCloud: number;
  closetOutfitFavouritesInCloud: number;
  closetOutfitWeekPlanInCloud: number;
};

export async function fetchCloudBackupStatus(): Promise<
  { ok: true; status: CloudBackupStatus } | { ok: false; message: string }
> {
  const response = await createApiClient().request<CloudBackupStatus>('/diagnostics/cloud-backup-status');
  if (!response.success || !response.data) {
    return { ok: false, message: response.error?.message ?? 'Unknown error (no error detail returned).' };
  }
  return { ok: true, status: response.data };
}
