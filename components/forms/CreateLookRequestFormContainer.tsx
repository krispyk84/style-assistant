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
      }),
    });
  }

  return (
    <CreateLookRequestFormView
      // Anchor items
      anchorItems={anchorForm.anchorItems}
      anchorError={anchorForm.anchorError}
      showAddToClosetCheckbox={anchorForm.showAddToClosetCheckbox}
      shouldAddAnchorToCloset={anchorForm.shouldAddAnchorToCloset}
      closetItems={anchorForm.closetItems}
      closetPickerVisible={anchorForm.closetPickerVisible}
      isUploading={anchorForm.isUploading}
      onUpdateAnchorItem={anchorForm.updateAnchorItem}
      onAddAnchorItem={anchorForm.addAnchorItem}
      onRemoveAnchorItem={anchorForm.removeAnchorItem}
      onPickFromCloset={anchorForm.handlePickFromCloset}
      onToggleSaveToCloset={anchorForm.toggleShouldAddAnchorToCloset}
      onClosetItemSelected={anchorForm.handleClosetItemSelected}
      onClosetPickerClose={anchorForm.handleClosetPickerClose}
      // Season
      selectedSeason={lookForm.selectedSeason}
      isSeasonExpanded={lookForm.isSeasonExpanded}
      onSelectSeason={lookForm.setSelectedSeason}
      onToggleSeasonExpanded={() => lookForm.setIsSeasonExpanded((v) => !v)}
      // Vibe keywords
      vibeKeywords={lookForm.vibeKeywords}
      isKeywordsExpanded={lookForm.isKeywordsExpanded}
      onChangeVibeKeywords={lookForm.setVibeKeywords}
      onToggleKeywordsExpanded={() => lookForm.setIsKeywordsExpanded((v) => !v)}
      onToggleVibeKeyword={lookForm.toggleVibeKeyword}
      // Tiers
      selectedTiers={lookForm.selectedTiers}
      tierError={lookForm.tierError}
      onToggleTier={lookForm.toggleTier}
      // Submit
      hasAnyInput={anchorForm.populatedAnchorItems.length > 0}
      onContinue={() => void handleContinue()}
    />
  );
}
