import { createApiClient } from '@/lib/api/api-client';

export type CloudBackupStatus = {
  savedOutfitsInCloud: number | string;
  closetItemsInCloud: number | string;
  weekPlanInCloud: number | string;
  closetOutfitFavouritesInCloud: number | string;
  closetOutfitWeekPlanInCloud: number | string;
  visibleTables: string[] | string;
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
