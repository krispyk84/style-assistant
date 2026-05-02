import { OutfitResultCard } from '@/components/cards/outfit-result-card';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { spacing } from '@/constants/theme';
import type { LookTierSlug } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';
import type { WeatherSeason } from '@/types/weather';
import type { useHistoryData } from './useHistoryData';

// ── Props ─────────────────────────────────────────────────────────────────────

type TierFilter = 'all' | LookTierSlug;
type SeasonFilter = 'all' | WeatherSeason;

type LooksHistoryTabProps = {
  data: ReturnType<typeof useHistoryData>;
  tierFilter: TierFilter;
  seasonFilter: SeasonFilter;
  onAddToWeek: (result: SavedOutfit) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

// ── View ──────────────────────────────────────────────────────────────────────

export function LooksHistoryTab({ data, tierFilter, seasonFilter, onAddToWeek }: LooksHistoryTabProps) {
  const {
    historyCards,
    historyLoading,
    historyError,
    historyLoadingMore,
    historyHasMore,
    deletingHistoryRequestId,
    handleDelete,
  } = data;

  if (historyLoading) return <LoadingState label="Loading history..." />;
  if (historyError) return <ErrorState title="History unavailable" message={historyError} />;

  const filtered = historyCards.filter((c) => {
    const tierMatch = tierFilter === 'all' || c.recommendation.tier === tierFilter;
    const seasonMatch = seasonFilter === 'all' || (c.input as any)?.weatherContext?.season === seasonFilter;
    return tierMatch && seasonMatch;
  });

  if (!filtered.length) {
    return historyCards.length ? (
      <EmptyState title="No matches" message="No generated looks match the selected filters." />
    ) : (
      <EmptyState
        title="No generated looks"
        message="Every look you generate will appear here. Create your first look to get started."
        actionLabel="Create a look"
        actionHref="/create-look"
      />
    );
  }

  return (
    <>
      {filtered.map((card) => {
        const result: SavedOutfit = {
          id: card.id,
          requestId: card.requestId,
          savedAt: card.createdAt,
          input: card.input as SavedOutfit['input'],
          recommendation: card.recommendation,
        };
        return (
          <OutfitResultCard
            key={card.id}
            result={result}
            dateLabel={`Created ${formatDate(card.createdAt)}`}
            onAddToWeek={() => onAddToWeek(result)}
            onDelete={
              deletingHistoryRequestId === card.requestId
                ? undefined
                : () => void handleDelete(card.requestId)
            }
          />
        );
      })}

      {/* Pagination indicator */}
      {historyLoadingMore ? (
        <LoadingState label="Loading more..." />
      ) : !historyHasMore ? (
        <AppText
          tone="muted"
          style={{ fontSize: 12, letterSpacing: 0.5, paddingVertical: spacing.sm, textAlign: 'center' }}>
          All looks loaded
        </AppText>
      ) : null}
    </>
  );
}
