import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  maxHeight?: number | `${number}%`;
  children: React.ReactNode;
};

/**
 * Shared bottom-sheet presenter.
 *
 * Backdrop and sheet are separate Animated.Views:
 *   - backdrop  → opacity fade only (never translates)
 *   - sheet     → translateY slide only (no background color)
 *
 * This prevents the "hard backdrop edge sweeping upward" artifact that
 * occurs when animationType="slide" is used on a Modal whose wrapper View
 * carries the overlay color.
 */
export function BottomSheetModal({
  visible,
  onClose,
  maxHeight = '75%',
  children,
}: BottomSheetModalProps) {
  const { theme } = useTheme();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;

  // `mounted` drives Modal visibility so we can play the exit animation
  // before the Modal unmounts — visible=false triggers animate-out → unmount.
  const [mounted, setMounted] = useState(visible);
  const isAnimatingOut = useRef(false);

  // When visible becomes true: mount the Modal.
  useEffect(() => {
    if (visible) {
      isAnimatingOut.current = false;
      setMounted(true);
    } else if (mounted && !isAnimatingOut.current) {
      isAnimatingOut.current = true;
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 800, duration: 240, useNativeDriver: true }),
      ]).start(() => {
        isAnimatingOut.current = false;
        setMounted(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // When modal mounts (or re-mounts after being hidden), animate in.
  useEffect(() => {
    if (!mounted) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(800);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return (
    <Modal animationType="none" transparent visible onRequestClose={onClose}>
      {/* Backdrop — full-screen, opacity only, never translates */}
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: theme.colors.overlay,
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />

      {/* Sheet — slides up independently of the backdrop */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight,
            overflow: 'hidden',
            transform: [{ translateY: sheetTranslateY }],
          }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
