import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type MoreBottomSheetProps = {
  onClose: () => void;
  onSignOut: () => void;
};

export function MoreBottomSheet({ onClose, onSignOut }: MoreBottomSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss(callback?: () => void) {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 300, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      callback?.();
    });
  }

  function handleTravelPlanner() {
    dismiss(() => router.push('/travel-planner'));
  }

  function handleSettings() {
    dismiss(() => router.push('/settings'));
  }

  function handleSignOut() {
    dismiss(onSignOut);
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && gs.dy > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetTranslateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const rowIconBg = theme.colors.card;

  return (
    <Modal animationType="none" transparent visible onRequestClose={() => dismiss()}>
      {/* Backdrop */}
      <Pressable style={{ flex: 1 }} onPress={() => dismiss()}>
        <Animated.View
          style={{
            backgroundColor: 'rgba(24, 18, 14, 0.52)',
            bottom: 0,
            left: 0,
            opacity: backdropOpacity,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          bottom: 0,
          left: 0,
          position: 'absolute',
          right: 0,
          transform: [{ translateY: sheetTranslateY }],
        }}>

        {/* Drag handle */}
        <View
          {...panResponder.panHandlers}
          style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <View
            style={{
              backgroundColor: theme.colors.border,
              borderRadius: 999,
              height: 4,
              width: 40,
            }}
          />
        </View>

        {/* Header */}
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            More
          </AppText>
        </View>

        {/* Rows */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: insets.bottom + spacing.xl }}>

          <Pressable
            onPress={handleTravelPlanner}
            style={({ pressed }) => [
              rowStyle,
              { backgroundColor: pressed ? theme.colors.subtleSurface : 'transparent' },
            ]}>
            <View style={[iconCircle, { backgroundColor: rowIconBg }]}>
              <AppIcon color={theme.colors.accent} name="suitcase" size={18} />
            </View>
            <AppText variant="sectionTitle" style={{ flex: 1 }}>Travel Planner</AppText>
            <AppIcon color={theme.colors.subtleText} name="chevron-right" size={14} />
          </Pressable>

          <Pressable
            onPress={handleSettings}
            style={({ pressed }) => [
              rowStyle,
              { backgroundColor: pressed ? theme.colors.subtleSurface : 'transparent' },
            ]}>
            <View style={[iconCircle, { backgroundColor: rowIconBg }]}>
              <AppIcon color={theme.colors.accent} name="settings" size={18} />
            </View>
            <AppText variant="sectionTitle" style={{ flex: 1 }}>Settings</AppText>
            <AppIcon color={theme.colors.subtleText} name="chevron-right" size={14} />
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={rowStyle}>
            <View style={[iconCircle, { backgroundColor: theme.colors.dangerSurface }]}>
              <AppIcon color={theme.colors.danger} name="log-out" size={18} />
            </View>
            <AppText variant="sectionTitle" style={{ flex: 1, color: theme.colors.danger }}>Sign Out</AppText>
          </Pressable>

        </View>
      </Animated.View>
    </Modal>
  );
}

const rowStyle = {
  alignItems: 'center' as const,
  borderRadius: 16,
  flexDirection: 'row' as const,
  gap: spacing.md,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.md,
};

const iconCircle = {
  alignItems: 'center' as const,
  borderRadius: 999,
  height: 36,
  justifyContent: 'center' as const,
  width: 36,
};
