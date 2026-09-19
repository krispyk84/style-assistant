import { appConfig } from '@/constants/config';
import { getApiAuthToken } from '@/lib/api/api-client';
import type { ApiResponse } from '@/types/api';
import type { ExtractItineraryInput, ExtractItineraryResponse, TripItineraryService } from './trip-itinerary-service';

// Mirrors services/transcription/api-transcription-service.ts's multipart XHR
// pattern — ApiClient.request always JSON-encodes its body, so a real file
// upload (here: an itinerary PDF) has to bypass it with a raw XHR, with the
// bearer token attached manually since /trip-itinerary/extract requires auth.
function extractWithXhr(input: ExtractItineraryInput): Promise<ApiResponse<ExtractItineraryResponse>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response: ApiResponse<ExtractItineraryResponse>) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    if (!appConfig.apiBaseUrl) {
      finish({
        success: false,
        data: null,
        error: { code: 'ITINERARY_CONFIG_MISSING', message: 'Missing EXPO_PUBLIC_API_BASE_URL for itinerary extraction.' },
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: input.file.uri,
      name: input.file.fileName,
      type: input.file.mimeType,
    } as never);
    formData.append('destination', input.destination);
    formData.append('departureDate', input.departureDate);
    formData.append('returnDate', input.returnDate);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${appConfig.apiBaseUrl}/trip-itinerary/extract`);
    xhr.timeout = 45000;

    const token = getApiAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.onerror = () => {
      finish({ success: false, data: null, error: { code: 'ITINERARY_EXTRACTION_FAILED', message: 'Could not read that itinerary. Please try again.' } });
    };

    xhr.ontimeout = () => {
      finish({ success: false, data: null, error: { code: 'ITINERARY_EXTRACTION_TIMEOUT', message: 'That took too long. Please try again.' } });
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish({ success: false, data: null, error: { code: 'ITINERARY_EXTRACTION_FAILED', message: 'Could not read that itinerary. Please try again.' } });
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText) as ApiResponse<ExtractItineraryResponse>;
        finish(parsed);
      } catch {
        finish({ success: false, data: null, error: { code: 'ITINERARY_RESPONSE_INVALID', message: 'The itinerary response could not be parsed.' } });
      }
    };

    xhr.onloadend = () => {
      if (!settled) {
        finish({ success: false, data: null, error: { code: 'ITINERARY_EXTRACTION_INCOMPLETE', message: 'That did not finish correctly. Please try again.' } });
      }
    };

    xhr.send(formData);
  });
}

export const apiTripItineraryService: TripItineraryService = {
  extractItinerary(input) {
    return extractWithXhr(input);
  },
};
