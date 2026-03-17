import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type LoadingStateProps = {
  label: string;
  messages?: string[];
};

export function LoadingState({ label, messages }: LoadingStateProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeLabel = messages?.length ? messages[Math.min(messageIndex, messages.length - 1)] : label;

  useEffect(() => {
    if (!messages?.length || messages.length === 1) {
      return;
    }

    const timeout = setInterval(() => {
      setMessageIndex((current) => (current < messages.length - 1 ? current + 1 : current));
    }, 2200);

    return () => clearInterval(timeout);
  }, [messages]);

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
      <ActivityIndicator color={theme.colors.text} />
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {activeLabel}
      </AppText>
    </View>
  );
}
