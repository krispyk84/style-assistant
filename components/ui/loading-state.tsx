import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type LoadingStateProps = {
  label: string;
  messages?: string[];
};

export function LoadingState({ label, messages }: LoadingStateProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageOrder, setMessageOrder] = useState<string[]>(messages ?? []);
  const activeLabel = messageOrder.length ? messageOrder[messageIndex % messageOrder.length] : label;
  const translateX = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (!messages?.length) {
      setMessageOrder([]);
      setMessageIndex(0);
      return;
    }

    const shuffledMessages = [...messages].sort(() => Math.random() - 0.5);
    setMessageOrder(shuffledMessages);
    setMessageIndex(0);
  }, [messages]);

  useEffect(() => {
    if (!messageOrder.length || messageOrder.length === 1) {
      return;
    }

    const timeout = setInterval(() => {
      setMessageIndex((current) => current + 1);
    }, 6600);

    return () => clearInterval(timeout);
  }, [messageOrder]);

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
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        padding: spacing.xl,
        gap: spacing.md,
      }}>
      <View
        style={{
          backgroundColor: theme.colors.border,
          borderRadius: 999,
          height: 10,
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
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {activeLabel}
      </AppText>
    </View>
  );
}
