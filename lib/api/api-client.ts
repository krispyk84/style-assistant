import { appConfig, assertApiBaseUrl } from '@/constants/config';
import type { ApiResponse } from '@/types/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

// Module-level token — set by auth-context on every session change so all
// requests automatically carry the current user's Bearer token.
let _authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  _authToken = token;
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (_authToken) {
        headers['Authorization'] = `Bearer ${_authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });

      // A 204 has no body by definition — calling .json() on it throws
      // (e.g. DELETE /trips/saved/:id), which this catch-all would otherwise
      // silently turn into a generic failure even though the request itself
      // succeeded, leaving callers unable to tell "deleted" from "failed".
      const payload: ApiResponse<T> = response.status === 204
        ? { success: true, data: null as T, error: null }
        : ((await response.json()) as ApiResponse<T>);

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: payload.error ?? {
            code: 'HTTP_ERROR',
            message: 'The request failed.',
          },
        };
      }

      return payload;
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
  }
}

export function createApiClient() {
  return new ApiClient(assertApiBaseUrl());
}

export function canUseRealApi() {
  return !appConfig.useMockServices && Boolean(appConfig.apiBaseUrl);
}
