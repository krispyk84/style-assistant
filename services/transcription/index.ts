import { canUseRealApi } from '@/lib/api/api-client';
import { apiTranscriptionService } from '@/services/transcription/api-transcription-service';
import { mockTranscriptionService } from '@/services/transcription/mock-transcription-service';

export const transcriptionService = canUseRealApi() ? apiTranscriptionService : mockTranscriptionService;
export type { RecordedAudioAsset, TranscribeAudioResponse } from './transcription-service';
