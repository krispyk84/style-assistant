import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
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
  const { favourites, favouritesLoading, favouritesError, deletingFavouriteId, handleDelete } = data;

  if (favouritesLoading) return <LoadingState label="Loading saved outfits..." />;
  if (favouritesError) return <ErrorState title="Favourites unavailable" message={favouritesError} />;

  const filtered = favourites.filter((r) => {
    const tierMatch = tierFilter === 'all' || r.recommendation.tier === tierFilter;
    const seasonMatch = seasonFilter === 'all' || r.input.weatherContext?.season === seasonFilter;
    return tierMatch && seasonMatch;
  });

  if (filtered.length) {
    return (
      <>
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
      </>
    );
  }

  if (favourites.length) {
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
