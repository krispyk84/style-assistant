import { router } from 'expo-router';

import { loadWeatherContext } from '@/lib/weather-storage';
import type { CreateLookInput } from '@/types/look-request';
import { useAnchorItemsForm } from './useAnchorItemsForm';
import { useCreateLookRequestForm } from './useCreateLookRequestForm';
import { buildSubmitRouteParams } from './createLookRequest-mappers';
import { CreateLookRequestFormView } from './CreateLookRequestFormView';

type CreateLookRequestFormProps = {
  initialValue?: CreateLookInput;
};

const DEFAULT_INITIAL_VALUE: CreateLookInput = {
  anchorItems: [],
  anchorItemDescription: '',
  anchorImage: null,
  uploadedAnchorImage: null,
  photoPending: false,
  selectedTiers: ['business', 'smart-casual', 'casual'],
};

export function CreateLookRequestForm({ initialValue = DEFAULT_INITIAL_VALUE }: CreateLookRequestFormProps) {
  const anchorForm = useAnchorItemsForm(initialValue);
  const lookForm = useCreateLookRequestForm(initialValue);

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

    router.push({
      pathname: '/review-request',
      params: buildSubmitRouteParams({
        populatedAnchorItems: anchorForm.populatedAnchorItems,
        vibeKeywords: lookForm.vibeKeywords,
        selectedTiers: lookForm.selectedTiers,
        shouldAddAnchorToCloset: anchorForm.shouldAddAnchorToCloset,
        weatherContext,
        manualSeason: lookForm.selectedSeason,
        includeBag: lookForm.includeBag,
        includeHat: lookForm.includeHat,
      }),
    });
  }

  return (
    <CreateLookRequestFormView
      anchorForm={anchorForm}
      lookForm={lookForm}
      onContinue={() => void handleContinue()}
    />
  );
}
