import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { spacing } from '@/constants/theme';

/**
 * Prev/next chevrons for a fullscreen image viewer — used by both the Fashion
 * Trend Report (trends + colours) and the haircut angle-shot viewer, so a
 * gallery-style cycle behaves identically everywhere in the app. Buttons are
 * disabled (not hidden) at either end so the layout never shifts and it's
 * always clear you've reached the first/last item.
 */
export function FullscreenNavArrows({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        alignItems: 'center',
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        left: 0,
        paddingHorizontal: spacing.md,
        position: 'absolute',
        right: 0,
        top: 0,
      }}>
      <NavArrowButton direction="prev" disabled={!canGoPrev} onPress={onPrev} />
      <NavArrowButton direction="next" disabled={!canGoNext} onPress={onNext} />
    </View>
  );
}

function NavArrowButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={12}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 999,
        height: 44,
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
        width: 44,
      }}>
      <AppIcon color="#fff" name={direction === 'prev' ? 'chevron-left' : 'chevron-right'} size={26} />
    </Pressable>
  );
}
