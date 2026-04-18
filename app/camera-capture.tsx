import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

import { AppIcon } from '@/components/ui/app-icon';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { cameraCaptureResult } from '@/lib/camera-capture-result';

const TIMER_OPTIONS = [0, 3, 5, 10] as const;
type TimerOption = (typeof TIMER_OPTIONS)[number];

export default function CameraCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [timerDelay, setTimerDelay] = useState<TimerOption>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
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

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <AppText style={{ color: '#FFF' }}>Loading camera…</AppText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl }}>
        <AppText style={{ color: '#FFF', textAlign: 'center' }}>Camera access is required to take a selfie.</AppText>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: theme.colors.accent, borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <AppText style={{ color: '#FFF' }}>Allow camera</AppText>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <AppText style={{ color: '#AAA', marginTop: spacing.sm }}>Cancel</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Camera viewfinder */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
      />

      {/* Flip camera button — top-right corner */}
      {countdown === null ? (
        <Pressable
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          style={{
            position: 'absolute',
            top: insets.top + spacing.md,
            right: spacing.lg,
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderRadius: 999,
            padding: spacing.sm,
          }}>
          <AppIcon name="camera-flip" size={26} color="#FFF" />
        </Pressable>
      ) : null}

      {/* Countdown overlay — full-screen dark backdrop with large number */}
      {countdown !== null ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
          {/* Use raw Text to avoid lineHeight conflict from AppText body variant */}
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: 'AvenirNext-DemiBold',
              fontSize: 120,
              lineHeight: 140,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}>
            {countdown}
          </Text>
          <Pressable
            onPress={clearCountdown}
            style={{
              marginTop: spacing.lg,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
            }}>
            <AppText style={{ color: '#FFF', fontSize: 16 }}>Cancel</AppText>
          </Pressable>
        </View>
      ) : null}

      {/* Controls bar at the bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + spacing.lg,
          paddingTop: spacing.lg,
          paddingHorizontal: spacing.xl,
          backgroundColor: 'rgba(0,0,0,0.55)',
          gap: spacing.lg,
          alignItems: 'center',
        }}>

        {/* Timer selector */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {TIMER_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => { clearCountdown(); setTimerDelay(option); }}
              style={{
                alignItems: 'center',
                backgroundColor: timerDelay === option ? theme.colors.accent : 'rgba(255,255,255,0.15)',
                borderColor: timerDelay === option ? theme.colors.accent : 'rgba(255,255,255,0.3)',
                borderRadius: 999,
                borderWidth: 1,
                minWidth: 52,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              }}>
              <AppText style={{ fontSize: 13, color: '#FFF' }}>
                {option === 0 ? 'Off' : `${option}s`}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Shutter row: cancel | capture | spacer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => { clearCountdown(); router.back(); }}
            style={{ width: 56, alignItems: 'center' }}>
            <AppText style={{ color: '#FFF', fontSize: 16 }}>Cancel</AppText>
          </Pressable>

          {/* Shutter button */}
          <Pressable
            onPress={countdown !== null ? undefined : handleCapture}
            disabled={isCapturing || countdown !== null}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isCapturing || countdown !== null ? 'rgba(255,255,255,0.4)' : '#FFF',
              borderWidth: 4,
              borderColor: 'rgba(255,255,255,0.6)',
            }}
          />

          {/* Spacer to balance cancel */}
          <View style={{ width: 56 }} />
        </View>
      </View>
    </View>
  );
}
