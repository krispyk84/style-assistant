import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type AnimatedLoadingBarProps = {
  height?: number;
  marginBottom?: number;
};

export function AnimatedLoadingBar({
  height = 10,
  marginBottom = spacing.md,
}: AnimatedLoadingBarProps) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 220,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -140,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.border,
        borderRadius: 999,
        height,
        marginBottom,
        overflow: 'hidden',
        width: '100%',
      }}>
      <Animated.View
        style={{
          backgroundColor: theme.colors.accent,
          borderRadius: 999,
          height: '100%',
          transform: [{ translateX }],
          width: 140,
        }}
      />
    </View>
  );
}
