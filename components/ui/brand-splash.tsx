import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type BrandSplashProps = {
  subtitle?: string;
  messages?: string[];
};

export function BrandSplash({ subtitle, messages }: BrandSplashProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeSubtitle = messages?.length ? messages[Math.min(messageIndex, messages.length - 1)] : subtitle;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!messages?.length || messages.length === 1) {
      return;
    }

    const timeout = setInterval(() => {
      setMessageIndex((current) => (current < messages.length - 1 ? current + 1 : current));
    }, 2200);

    return () => clearInterval(timeout);
  }, [messages]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
      }}>
      <View
        style={{
          alignItems: 'center',
          gap: spacing.xl,
          width: '100%',
        }}>
        {/* Animated Logo Icon */}
        <Animated.View 
          style={{ 
            transform: [{ scale: pulseAnim }],
          }}>
          <View 
            style={{ 
              width: 100, 
              height: 100, 
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.text,
              alignItems: 'center',
              justifyContent: 'center',
              ...theme.shadows.lg,
            }}>
            <Ionicons name="shirt-outline" size={48} color={theme.colors.surface} />
          </View>
        </Animated.View>

        {/* Brand Name */}
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="hero" style={{ letterSpacing: 2 }}>Vesture</AppText>
          <AppText variant="eyebrow" tone="subtle">Personal Style Assistant</AppText>
        </View>
        
        {/* Loading Message */}
        {activeSubtitle && (
          <View 
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.full,
              ...theme.shadows.sm,
            }}>
            <View 
              style={{ 
                width: 8, 
                height: 8, 
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.accent,
              }} 
            />
            <AppText variant="caption" tone="muted">
              {activeSubtitle}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
