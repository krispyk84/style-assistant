import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export type SwapOutfitWorkflow = 'buildAroundPiece' | 'askStylist';

type SwapOutfitChooserSheetProps = {
  visible: boolean;
  onPick: (workflow: SwapOutfitWorkflow) => void;
  onDismiss: () => void;
};

// Same structural pattern as SourcePickerSheet.tsx (trip-anchors' camera/
// library/closet picker) — a small bottom sheet choosing between the app's
// two main outfit-generation workflows.
export function SwapOutfitChooserSheet({ visible, onPick, onDismiss }: SwapOutfitChooserSheetProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropAnim.setValue(0);
      slideAnim.setValue(300);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim, backdropAnim]);

  const options: { workflow: SwapOutfitWorkflow; icon: 'shirt' | 'chat'; label: string; description: string }[] = [
    { workflow: 'buildAroundPiece', icon: 'shirt', label: 'Build Around a Piece', description: 'Start from a piece or your closet, formality already matched to this day.' },
    { workflow: 'askStylist', icon: 'chat', label: 'Ask a Stylist', description: 'Let Vittorio or Alessandra pick an outfit for this day.' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={{ flex: 1, opacity: backdropAnim }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onDismiss}>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => {/* stop propagation */}}>
            <Animated.View style={{
              transform: [{ translateY: slideAnim }],
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing.lg,
              gap: spacing.sm,
            }}>
              <AppText style={{
                color: theme.colors.mutedText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                textAlign: 'center',
                marginBottom: spacing.xs,
              }}>
                Swap this day&apos;s outfit
              </AppText>

              {options.map((opt) => (
                <Pressable
                  key={opt.workflow}
                  onPress={() => { onPick(opt.workflow); onDismiss(); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    padding: spacing.md,
                  }}>
                  <AppIcon name={opt.icon} color={theme.colors.text} size={18} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14, color: theme.colors.text }}>
                      {opt.label}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: theme.colors.mutedText }}>
                      {opt.description}
                    </AppText>
                  </View>
                </Pressable>
              ))}

              <Pressable
                onPress={onDismiss}
                style={{
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  marginTop: spacing.xs,
                }}>
                <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                  Cancel
                </AppText>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
