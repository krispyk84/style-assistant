import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function useClosetAnimations(isLoading: boolean) {
  const translateX = useRef(new Animated.Value(-140)).current;

  // Loading bar animation
  useEffect(() => {
    if (!isLoading) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 220, duration: 1400, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isLoading, translateX]);

  return { translateX };
}
