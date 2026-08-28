import { ActivityIndicator, View } from 'react-native';

import { ClosetOutfitCard } from '@/components/cards/closet-outfit-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import { useGenerateOutfitsResults } from './useGenerateOutfitsResults';

export function GenerateOutfitsScreen() {
  const {
    formality, stage, outfits, selectedOutfit, variations, error,
    loadOutfits, selectOutfit, backToOutfits,
  } = useGenerateOutfitsResults();

  const isLoading = stage === 'loading' || stage === 'variations-loading';
  const isVariations = stage === 'variations' || stage === 'variations-loading';

  return (
    <AppScreen scrollable floatingBack>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title={isVariations ? 'Outfit Variations' : 'Outfit Ideas'} showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">
            {isVariations ? `Variations on "${selectedOutfit?.title ?? ''}"` : `${formatTierLabel(formality)} outfits from your closet`}
          </AppText>
          <AppText tone="muted">
            {isVariations
              ? 'Same look, 1–2 pieces swapped — pick your favorite.'
              : 'Five complete looks built entirely from what you already own.'}
          </AppText>
        </View>

        {isVariations && stage !== 'variations-loading' ? (
          <PrimaryButton label="Back to the 5 outfits" onPress={backToOutfits} variant="secondary" />
        ) : null}

        {isLoading ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              {stage === 'variations-loading'
                ? 'Swapping in a few pieces...'
                : 'Scanning your closet for combinations...'}
            </AppText>
          </View>
        ) : stage === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <AppText style={{ color: theme.colors.danger, textAlign: 'center' }}>{error}</AppText>
            <PrimaryButton label="Try again" onPress={() => void loadOutfits()} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {(stage === 'variations' ? variations : outfits).map((outfit) => (
              <ClosetOutfitCard
                key={outfit.id}
                outfit={outfit}
                selected={!isVariations && selectedOutfit?.id === outfit.id}
                onPress={isVariations ? undefined : () => void selectOutfit(outfit)}
              />
            ))}
          </View>
        )}
      </View>
    </AppScreen>
  );
}
