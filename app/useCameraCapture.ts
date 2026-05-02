import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { cameraCaptureResult } from '@/lib/camera-capture-result';

export const TIMER_OPTIONS = [0, 3, 5, 10] as const;
export type TimerOption = (typeof TIMER_OPTIONS)[number];

export type CameraFacing = 'front' | 'back';

export function useCameraCapture() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [timerDelay, setTimerDelay] = useState<TimerOption>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearCountdown() {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }

  useEffect(() => () => clearCountdown(), []);

  async function capturePhoto() {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        cameraCaptureResult.emit({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          mimeType: 'image/jpeg',
        });
      }
    } finally {
      setIsCapturing(false);
    }
    router.back();
  }

  function handleCapture() {
    if (timerDelay === 0) {
      void capturePhoto();
      return;
    }
    setCountdown(timerDelay);
    let remaining = timerDelay;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        void capturePhoto();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  function selectTimer(option: TimerOption) {
    clearCountdown();
    setTimerDelay(option);
  }

  function flipCamera() {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  }

  function cancel() {
    clearCountdown();
    router.back();
  }

  return {
    permission,
    requestPermission,
    cameraRef,
    timerDelay,
    countdown,
    isCapturing,
    facing,
    handleCapture,
    selectTimer,
    flipCamera,
    clearCountdown,
    cancel,
  };
}
