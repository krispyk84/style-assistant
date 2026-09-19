import { appConfig } from '@/constants/config';
import { getApiAuthToken } from '@/lib/api/api-client';
import type { ApiResponse } from '@/types/api';
import type { RecordedAudioAsset, TranscribeAudioResponse, TranscriptionService } from './transcription-service';

// Mirrors services/uploads/api-uploads-service.ts's multipart XHR pattern —
// ApiClient.request always JSON-encodes its body, so a real file upload
// (here: a short audio recording) has to bypass it with a raw XHR. Unlike
// uploads (/uploads has no auth requirement), /stylist-brief/transcribe
// requires auth, so the current bearer token is attached manually via
// getApiAuthToken() — ApiClient.request does this internally, but that
// path isn't available for a multipart body.
function transcribeWithXhr(audio: RecordedAudioAsset): Promise<ApiResponse<TranscribeAudioResponse>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response: ApiResponse<TranscribeAudioResponse>) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    if (!appConfig.apiBaseUrl) {
      finish({
        success: false,
        data: null,
        error: { code: 'TRANSCRIPTION_CONFIG_MISSING', message: 'Missing EXPO_PUBLIC_API_BASE_URL for transcription.' },
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: audio.uri,
      name: audio.fileName,
      type: audio.mimeType,
    } as never);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${appConfig.apiBaseUrl}/stylist-brief/transcribe`);
    xhr.timeout = 45000;

    const token = getApiAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.onerror = () => {
      finish({ success: false, data: null, error: { code: 'TRANSCRIPTION_FAILED', message: 'Transcription failed.' } });
    };

    xhr.ontimeout = () => {
      finish({ success: false, data: null, error: { code: 'TRANSCRIPTION_TIMEOUT', message: 'Transcription took too long. Please try again.' } });
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish({ success: false, data: null, error: { code: 'TRANSCRIPTION_FAILED', message: 'Transcription failed.' } });
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText) as ApiResponse<TranscribeAudioResponse>;
        finish(parsed);
      } catch {
        finish({ success: false, data: null, error: { code: 'TRANSCRIPTION_RESPONSE_INVALID', message: 'Transcription response could not be parsed.' } });
      }
    };

    xhr.onloadend = () => {
      if (!settled) {
        finish({ success: false, data: null, error: { code: 'TRANSCRIPTION_INCOMPLETE', message: 'Transcription did not finish correctly. Please try again.' } });
      }
    };

    xhr.send(formData);
  });
}

export const apiTranscriptionService: TranscriptionService = {
  transcribeAudio(audio) {
    return transcribeWithXhr(audio);
  },
};
