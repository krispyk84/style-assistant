import { View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS } from '@/lib/stylists';
import type { SecondOpinionResponse } from '@/types/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export type StylistOpinionResultViewProps = {
  result: SecondOpinionResponse;
  onReset: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function StylistOpinionResultView({ result, onReset }: StylistOpinionResultViewProps) {
  const stylist = STYLISTS.find((s) => s.id === result.stylistId);

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Stylist identity row */}
      {stylist ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View
            style={{
              borderColor: theme.colors.border,
              borderRadius: 28,
              borderWidth: 1,
              height: 56,
              overflow: 'hidden',
              width: 56,
            }}>
            <Image contentFit="cover" contentPosition="top" source={stylist.image} style={{ height: '100%', width: '100%' }} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="sectionTitle">{stylist.name}</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Second Opinion</AppText>
          </View>
        </View>
      ) : null}

      {/* Perspective — the main conversational opinion */}
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftWidth: 3,
          borderRadius: 16,
          borderWidth: 1,
          padding: spacing.md,
        }}>
        <AppText tone="muted" style={{ fontStyle: 'italic', lineHeight: 24 }}>
          "{result.perspective}"
        </AppText>
      </View>

      <PrimaryButton label="Ask another stylist" onPress={onReset} variant="secondary" />
    </View>
  );
}
