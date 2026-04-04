import type { LocalImageAsset } from '@/types/media';

type CaptureListener = (image: LocalImageAsset) => void;

let _listener: CaptureListener | null = null;

export const cameraCaptureResult = {
  setListener(fn: CaptureListener) {
    _listener = fn;
  },
  clearListener() {
    _listener = null;
  },
  emit(image: LocalImageAsset) {
    _listener?.(image);
    _listener = null;
  },
};
