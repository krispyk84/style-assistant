import type { TranscriptionService } from './transcription-service';

export const mockTranscriptionService: TranscriptionService = {
  async transcribeAudio() {
    return {
      success: true,
      data: { text: 'Mock transcription — dictated stylist brief would appear here.' },
      error: null,
    };
  },
};
