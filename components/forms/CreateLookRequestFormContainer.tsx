import { router } from 'expo-router';

import { loadWeatherContext } from '@/lib/weather-storage';
import type { CreateLookInput, LookTierSlug } from '@/types/look-request';
import { useAnchorItemsForm } from './useAnchorItemsForm';
import { useCreateLookRequestForm } from './useCreateLookRequestForm';
import { buildSubmitRouteParams } from './createLookRequest-mappers';
import { CreateLookRequestFormView } from './CreateLookRequestFormView';

type CreateLookRequestFormProps = {
  initialValue?: CreateLookInput;
  /** Set only when launched to swap a trip day's outfit — locks the tier picker and forces exactly 3 looks (see CreateLookRequestFormView). */
  lockedTier?: LookTierSlug;
  /** Set only when launched to swap a trip day's outfit — carried through to the results screen so it can show a "Use for [Day]" action instead of (or alongside) Save/Add to Week. */
  swapDayTitle?: string;
  swapTripId?: string;
  swapSavedTripId?: string;
};

const DEFAULT_INITIAL_VALUE: CreateLookInput = {
  anchorItems: [],
  anchorItemDescription: '',
  anchorImage: null,
  uploadedAnchorImage: null,
  photoPending: false,
  selectedTiers: ['business', 'smart-casual', 'casual'],
};

export function CreateLookRequestForm({ initialValue = DEFAULT_INITIAL_VALUE, lockedTier, swapDayTitle, swapTripId, swapSavedTripId }: CreateLookRequestFormProps) {
  const anchorForm = useAnchorItemsForm(initialValue);
  const lookForm = useCreateLookRequestForm(initialValue, { initialLookCount: lockedTier ? 3 : undefined });

  async function handleContinue() {
    if (!anchorForm.populatedAnchorItems.length) {
      anchorForm.setAnchorError('Add an image, a description, or both before continuing.');
      return;
    }

    if (!lookForm.selectedTiers.length) {
      lookForm.setTierError('Select at least one outfit tier.');
      return;
    }

    const weatherContext = await loadWeatherContext();

    // Was previously a two-step flow (push to /review-request, which minted
    // its own fresh requestId and re-derived these same params just to show
    // a read-only summary before pushing again to /results/[requestId]).
    // That confirm screen added a step without adding a decision — every
    // value on it was already fixed by this form — so it's skipped now;
    // buildSubmitRouteParams already returns everything /results/[requestId]
    // needs, including the requestId itself.
    router.push({
      pathname: '/results/[requestId]',
      params: {
        ...buildSubmitRouteParams({
          populatedAnchorItems: anchorForm.populatedAnchorItems,
          vibeKeywords: lookForm.vibeKeywords,
          selectedTiers: lookForm.selectedTiers,
          shouldAddAnchorToCloset: anchorForm.shouldAddAnchorToCloset,
          weatherContext,
          manualSeason: lookForm.selectedSeason,
          includeBag: lookForm.includeBag,
          includeHat: lookForm.includeHat,
          closetOnly: lookForm.closetOnly,
          additionalDetails: lookForm.additionalDetails,
          lookCount: lookForm.lookCount,
        }),
        ...(swapDayTitle ? { swapDayTitle, swapTripId, swapSavedTripId } : {}),
      },
    });
  }

  return (
    <CreateLookRequestFormView
      anchorForm={anchorForm}
      lookForm={lookForm}
      onContinue={() => void handleContinue()}
      lockedTier={lockedTier}
    />
  );
}
