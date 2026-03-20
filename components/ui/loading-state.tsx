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

export const extendedFashionLoadingMessages = [
  'Tailoring your next great outfit.',
  'Pressing lapels and polishing loafers.',
  'Arguing softly with the imaginary stylist in Milan.',
  'Checking whether this deserves a compliment at dinner.',
  'Steaming the lookbook and adjusting the hem.',
  'Making sure the outfit says effortless, not accidental.',
  'Deciding how much swagger is appropriate here.',
  'Matching confidence levels to trouser drape.',
  'Politely declining one too many belts.',
  'Testing whether this jacket can carry a room.',
  'Removing exactly one accessory for restraint.',
  'Making the sneakers earn their place.',
  'Checking cuff length like it is a constitutional duty.',
  'Seeing if the knit says refined or just sleepy.',
  'Giving the blazer a quick reality check.',
  'Making sure the palette is intentional, not confused.',
  'Translating your anchor piece into civilized company.',
  'Trying on twelve versions of cool behind the scenes.',
  'Quietly vetoing anything too try-hard.',
  'Balancing elegance against a healthy amount of menace.',
  'Making sure the trousers break in the right places.',
  'Consulting the council of tasteful outerwear.',
  'Convincing the loafers to behave themselves.',
  'Removing one dramatic flourish in the name of discipline.',
  'Making the outfit look expensive without acting loud.',
  'Checking whether this belongs at brunch or in a spy film.',
  'Ensuring the fit says composed, not compressed.',
];
