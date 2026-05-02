import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type SourcePickerSheetProps = {
  visible: boolean;
  hasCloset: boolean;
  onPickCloset: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onDismiss: () => void;
};

export function SourcePickerSheet({
  visible,
  hasCloset,
  onPickCloset,
  onPickCamera,
  onPickLibrary,
  onDismiss,
}: SourcePickerSheetProps) {
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

  const options: { icon: AppIconName; label: string; onPress: () => void; disabled?: boolean }[] = [
    { icon: 'camera', label: 'Take photo', onPress: onPickCamera },
    { icon: 'upload', label: 'Upload from library', onPress: onPickLibrary },
    { icon: 'closet', label: hasCloset ? 'Select from closet' : 'No closet items yet', onPress: onPickCloset, disabled: !hasCloset },
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
                Add anchor piece
              </AppText>

              {options.map((opt) => (
                <Pressable
                  key={opt.label}
                  disabled={opt.disabled}
                  onPress={() => { opt.onPress(); onDismiss(); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    backgroundColor: opt.disabled ? theme.colors.subtleSurface : theme.colors.background,
                    borderColor: theme.colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    padding: spacing.md,
                    opacity: opt.disabled ? 0.5 : 1,
                  }}>
                  <AppIcon name={opt.icon} color={opt.disabled ? theme.colors.subtleText : theme.colors.text} size={18} />
                  <AppText style={{
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 14,
                    color: opt.disabled ? theme.colors.subtleText : theme.colors.text,
                  }}>
                    {opt.label}
                  </AppText>
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
