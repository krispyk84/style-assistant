import { useEffect, useRef, useState } from 'react';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { closetFitCheckService } from '@/services/closet-fit-check';
import { closetService } from '@/services/closet';
import { loadAppSettings } from '@/lib/app-settings-storage';
import { recordError } from '@/lib/crashlytics';
import { ensureNotificationPermission } from '@/lib/notification-permission';
import { consumePendingShare, usePendingShare } from '@/lib/share-handoff';
import type { ClosetFitCheckResponse } from '@/types/api';
import type { ClosetItem } from '@/types/closet';
import type { LocalImageAsset } from '@/types/media';

function mimeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// Owns: image picking/upload, optional notes, the AI request, the report state.
// Closet items are pre-loaded so the result screen can render thumbnails for
// `similarClosetItemIds` without a second round trip.

export function useClosetFitCheck() {
  const image = useUploadedImage('candidate-piece');
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [report, setReport] = useState<ClosetFitCheckResponse | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  // Closet items are only needed once the report renders, but we load eagerly
  // so the result screen never blocks on a second network call.
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) setClosetItems(response.data.items);
    });
  }, []);

  // First time the user opens this screen, request notification permission —
  // local notifications are the share-extension's one-tap path back into the
  // app. The helper is idempotent and never re-asks within a session.
  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  // ── Share-extension handoff ──────────────────────────────────────────────
  // When the iOS Share Extension drops an image into the App Group and opens
  // the app, share-handoff.ts copies it into the cache and notifies us via
  // `usePendingShare`. We ingest the file into the upload pipeline once,
  // and clear the pending share so navigating away & back doesn't re-ingest.
  const pendingShare = usePendingShare();
  const ingestedShareIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingShare) return;
    if (ingestedShareIdRef.current === pendingShare.id) return;
    if (image.image || image.uploadedImage || image.isUploading) {
      // User already has an image attached; defer to their choice but still
      // mark the share consumed so it doesn't keep firing on every re-render.
      ingestedShareIdRef.current = pendingShare.id;
      consumePendingShare();
      return;
    }
    ingestedShareIdRef.current = pendingShare.id;
    const asset: LocalImageAsset = {
      uri: pendingShare.localUri,
      fileName: pendingShare.fileName,
      mimeType: mimeFromFileName(pendingShare.fileName),
    };
    image.setImage(asset);
    consumePendingShare();
    void image.uploadImage(asset);
    // image methods are stable hook returns; intentionally only re-run on
    // share change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShare]);

  function reset() {
    image.removeImage();
    setReport(null);
    setAnalysisError(null);
    setNotes('');
  }

  function clearReport() {
    setReport(null);
    setAnalysisError(null);
  }

  async function runAnalysis() {
    if (!image.uploadedImage) {
      setAnalysisError('Upload an image of the piece first.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const settings = await loadAppSettings();
      const response = await closetFitCheckService.evaluate({
        uploadedImageId: image.uploadedImage.id,
        uploadedImageUrl: image.uploadedImage.publicUrl,
        notes: notes.trim() || undefined,
        trendiness: settings.trendiness,
      });
      if (!response.success || !response.data) {
        setAnalysisError(response.error?.message ?? 'Could not evaluate this piece. Please try again.');
        return;
      }
      setReport(response.data);
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'closet_fit_check');
      setAnalysisError('Could not evaluate this piece. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return {
    image,
    notes,
    setNotes,
    isAnalyzing,
    analysisError,
    report,
    closetItems,
    runAnalysis,
    reset,
    clearReport,
  };
}
