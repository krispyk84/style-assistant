import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';

import { tripItineraryService } from '@/services/trip-itinerary';

type Status = 'idle' | 'uploading';

/**
 * Picks a PDF itinerary and extracts a day-by-day breakdown from it,
 * filtered server-side to the overlap with this trip's own destination/date
 * range (see trip-itinerary.service.ts). Upload is an input METHOD, not a
 * separate workflow — a failure never blocks the user from filling in their
 * plans manually; it only surfaces `error` for the UI to show.
 */
export function useItineraryUpload() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  // Zero-overlap isn't a failure (the PDF was read fine, nothing in it
  // matched this trip's dates/destination) — kept separate from `error` so
  // the UI can show it as an informational note, not a red error state.
  const [noOverlapMessage, setNoOverlapMessage] = useState<string | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  async function pickAndExtract(params: {
    destination: string;
    departureDate: string;
    returnDate: string;
    onExtracted: (days: { date: string; summary: string }[]) => void;
  }) {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    setError(null);
    setNoOverlapMessage(null);
    setExcludedCount(0);
    setFileName(asset.name);
    setStatus('uploading');

    try {
      const response = await tripItineraryService.extractItinerary({
        file: { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? 'application/pdf' },
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
      });

      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'Could not read that itinerary. You can still fill in your plans manually.');
        return;
      }

      if (response.data.days.length === 0) {
        setNoOverlapMessage('We couldn\'t match any days from your itinerary to this trip\'s dates and destination — you can still continue without it.');
        return;
      }

      setExcludedCount(response.data.excludedCount);
      params.onExtracted(response.data.days);
    } finally {
      setStatus('idle');
    }
  }

  return {
    isUploading: status === 'uploading',
    error,
    noOverlapMessage,
    excludedCount,
    fileName,
    pickAndExtract: (params: Parameters<typeof pickAndExtract>[0]) => void pickAndExtract(params),
    clearError: () => setError(null),
  };
}
