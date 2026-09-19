import type { ApiResponse } from '@/types/api';

export type RecordedAudioAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export type TranscribeAudioResponse = {
  text: string;
};

export type TranscriptionService = {
  transcribeAudio: (audio: RecordedAudioAsset) => Promise<ApiResponse<TranscribeAudioResponse>>;
};
