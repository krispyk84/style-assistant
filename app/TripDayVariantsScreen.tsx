import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { OutfitItemThumbnailRow } from '@/components/cards/OutfitItemThumbnailRow';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTripDayLabeledPieces } from '@/lib/outfit-piece-display';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';
import { useTripDayVariants } from './useTripDayVariants';

export function TripDayVariantsScreen() {
  const { isLoading, errorMessage, variants, closetItems, swappedItems, selectVariant } = useTripDayVariants();

  return (
    <AppScreen scrollable floatingBack avoidsKeyboard={false}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Choose a Variant" showBack />

        {swappedItems.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="muted">Swapping Out</AppText>
            <OutfitItemThumbnailRow items={swappedItems} />
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingVertical: spacing.md }}>
            <LoadingState label="Styling alternatives..." />
          </View>
        ) : errorMessage ? (
          <ErrorState title="Couldn't generate variants" message={errorMessage} />
        ) : (
          <View style={{ gap: spacing.lg }}>
            <AppText tone="muted">Pick the one you like — the rest of this outfit stays the same.</AppText>
            {variants.map((variant, index) => (
              <VariantCard
                key={`${variant.dayIndex}-${index}`}
                variant={variant}
                closetItems={closetItems}
                onSelect={() => selectVariant(variant)}
              />
            ))}
          </View>
        )}
      </View>
    </AppScreen>
  );
}

function VariantCard({
  variant,
  closetItems,
  onSelect,
}: {
  variant: TripOutfitDay;
  closetItems: ClosetItem[];
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const items = useMemo(
    () =>
      buildTripDayLabeledPieces(variant, closetItems)
        .filter((piece) => piece.matchedClosetItem)
        .map((piece) => ({
          id: piece.matchedClosetItem!.id,
          title: piece.matchedClosetItem!.title,
          imageUrl: piece.matchedClosetItem!.sketchImageUrl ?? piece.matchedClosetItem!.uploadedImageUrl,
        })),
    [variant, closetItems],
  );

  return (
    <Pressable
      onPress={onSelect}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}>
      <View style={{ gap: 2 }}>
        <AppText variant="sectionTitle">{variant.title}</AppText>
        <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{variant.rationale}</AppText>
      </View>
      <OutfitItemThumbnailRow items={items} />
      <PrimaryButton label="Select this outfit" onPress={onSelect} />
    </Pressable>
  );
}
