import { View } from 'react-native';

import { ClosetOutfitCard } from '@/components/cards/closet-outfit-card';
import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { spacing } from '@/constants/theme';
import type { LookTierSlug } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';
import type { WeatherSeason } from '@/types/weather';
import type { useFavouritesData } from './useFavouritesData';

// ── Props ─────────────────────────────────────────────────────────────────────

type TierFilter = 'all' | LookTierSlug;
type SeasonFilter = 'all' | WeatherSeason;

type LooksFavouritesTabProps = {
  data: ReturnType<typeof useFavouritesData>;
  tierFilter: TierFilter;
  seasonFilter: SeasonFilter;
  onAddToWeek: (result: SavedOutfit) => void;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function LooksFavouritesTab({ data, tierFilter, seasonFilter, onAddToWeek }: LooksFavouritesTabProps) {
  const {
    favourites, favouritesLoading, favouritesError, deletingFavouriteId, handleDelete,
    closetFavourites, deletingClosetFavouriteId, handleDeleteClosetFavourite,
  } = data;

  if (favouritesLoading) return <LoadingState label="Loading saved outfits..." />;
  if (favouritesError) return <ErrorState title="Favourites unavailable" message={favouritesError} />;

  const filtered = favourites.filter((r) => {
    const tierMatch = tierFilter === 'all' || r.recommendation.tier === tierFilter;
    const seasonMatch = seasonFilter === 'all' || r.input.weatherContext?.season === seasonFilter;
    return tierMatch && seasonMatch;
  });

  // Closet-generated outfits don't carry a per-outfit season, so only the tier
  // (formality) filter applies to them — a season filter neither includes nor
  // excludes this section.
  const filteredClosetOutfits = closetFavourites.filter(
    (item) => tierFilter === 'all' || item.formality === tierFilter,
  );

  if (!filtered.length && !filteredClosetOutfits.length) {
    if (favourites.length || closetFavourites.length) {
      return (
        <EmptyState
          title="No matches"
          message="No saved outfits match the selected filters."
        />
      );
    }

    return (
      <EmptyState
        title="No saved outfits"
        message="Save a recommendation from the result page and it will appear here."
        actionLabel="Create a look"
        actionHref="/create-look"
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {filtered.map((result) => (
        <OutfitResultCard
          key={result.id}
          result={result}
          onAddToWeek={() => onAddToWeek(result)}
          onDelete={
            deletingFavouriteId === result.id
              ? undefined
              : () => void handleDelete(result.id)
          }
        />
      ))}

      {filteredClosetOutfits.length ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="sectionTitle">From your closet</AppText>
          {filteredClosetOutfits.map((item) => (
            <ClosetOutfitCard
              key={item.id}
              outfit={item.outfit}
              onDelete={
                deletingClosetFavouriteId === item.id
                  ? undefined
                  : () => void handleDeleteClosetFavourite(item.id)
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
