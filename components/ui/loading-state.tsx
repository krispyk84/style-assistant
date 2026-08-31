import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { AppText } from '@/components/ui/app-text';

type LoadingStateProps = {
  label: string;
  messages?: string[];
  /**
   * Real, already-known progress (e.g. "2 of 3 looks ready", "day 3 of 7") —
   * never a fabricated percentage. When provided, the bar shows an actual
   * determinate fill instead of the indeterminate pulse.
   */
  progress?: { current: number; total: number };
};

/** Not yet used elsewhere in the app — first real usage of Reduce Motion handling. */
function useReduceMotionPreference(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export function LoadingState({ label, messages, progress }: LoadingStateProps) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotionPreference();
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageOrder, setMessageOrder] = useState<string[]>(messages ?? []);
  const activeLabel = messageOrder.length ? messageOrder[messageIndex % messageOrder.length] : label;

  // Calm indeterminate "breathing" pulse — replaces the old fast sliding
  // sweep, which used the same brisk speed regardless of whether the wait
  // was 2 seconds or 30. Reduce Motion collapses this to a static bar.
  const pulse = useSharedValue(0.4);

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
    if (progress || reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = withTiming(progress ? 1 : 0.55, { duration: 400 });
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [progress, reduceMotion, pulse]);

  const fillStyle = useAnimatedStyle(() => {
    if (progress && progress.total > 0) {
      return { opacity: 1, width: `${Math.min(100, Math.max(4, (progress.current / progress.total) * 100))}%` };
    }
    return { opacity: pulse.value, width: '100%' };
  });

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
          height: 6,
          overflow: 'hidden',
          width: '100%',
        }}>
        <Animated.View style={[{ backgroundColor: theme.colors.accent, borderRadius: 999, height: '100%' }, fillStyle]} />
      </View>
      {progress ? (
        <AppText
          variant="eyebrow"
          style={{ color: theme.colors.subtleText, textAlign: 'center' }}>
          {progress.current} of {progress.total} ready
        </AppText>
      ) : null}
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
