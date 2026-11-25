import { assertApiBaseUrl } from '@/constants/config';
import { getApiAuthToken } from '@/lib/api/api-client';
import { appVersionHeaders } from '@/lib/app-version';
import type { ApiResponse } from '@/types/api';

// Not routed through ApiClient — that wrapper always JSON-parses the
// response body, which a binary ZIP download can't go through.
export const closetExportService = {
  async downloadArchive(): Promise<ApiResponse<ArrayBuffer>> {
    try {
      const token = getApiAuthToken();
      const headers: Record<string, string> = { ...appVersionHeaders() };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${assertApiBaseUrl()}/closet/export`, { headers });
      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: { code: 'EXPORT_FAILED', message: `Export failed (HTTP ${response.status}).` },
        };
      }

      return { success: true, data: await response.arrayBuffer(), error: null };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected network error.',
        },
      };
    }
  },
};
