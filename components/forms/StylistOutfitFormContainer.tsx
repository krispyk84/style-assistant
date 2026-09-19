import { router } from 'expo-router';
import { useState } from 'react';

import { loadWeatherContext } from '@/lib/weather-storage';
import { outfitsService } from '@/services/outfits';
import { useAnchorItemsForm } from './useAnchorItemsForm';
import { useStylistOutfitForm } from './useStylistOutfitForm';
import { buildSubmitRouteParams } from './createLookRequest-mappers';
import { StylistOutfitFormView } from './StylistOutfitFormView';

const STYLIST_LOOK_COUNT = 3;

export function StylistOutfitForm() {
  const anchorForm = useAnchorItemsForm({
    anchorItems: [],
    anchorItemDescription: '',
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: false,
    selectedTiers: ['smart-casual'],
  });
  const stylistForm = useStylistOutfitForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleGenerate() {
    if (isSubmitting) return;

    let hasError = false;
    if (!anchorForm.populatedAnchorItems.length) {
      anchorForm.setAnchorError('Add an image, a description, or both before continuing.');
      hasError = true;
    }
    if (!stylistForm.stylistId) {
      stylistForm.setStylistError('Choose a stylist to continue.');
      hasError = true;
    }
    if (!stylistForm.stylistBrief.trim()) {
      stylistForm.setBriefError('Tell your stylist what you need before generating.');
      hasError = true;
    }
    if (hasError) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const [tierResult, weatherContext] = await Promise.all([
        outfitsService.inferStylistTier(stylistForm.stylistBrief.trim()),
        loadWeatherContext(),
      ]);

      if (!tierResult.success || !tierResult.data) {
        setSubmitError(tierResult.error?.message ?? 'Could not understand the brief. Please try rephrasing it.');
        setIsSubmitting(false);
        return;
      }

      router.push({
        pathname: '/results/[requestId]',
        params: buildSubmitRouteParams({
          populatedAnchorItems: anchorForm.populatedAnchorItems,
          vibeKeywords: '',
          selectedTiers: [tierResult.data.tier],
          shouldAddAnchorToCloset: anchorForm.shouldAddAnchorToCloset,
          weatherContext,
          manualSeason: null,
          includeBag: false,
          includeHat: false,
          closetOnly: stylistForm.closetOnly,
          additionalDetails: stylistForm.stylistBrief.trim(),
          lookCount: STYLIST_LOOK_COUNT,
          stylistId: stylistForm.stylistId!,
        }),
      });
      // Not resetting isSubmitting on success — the screen navigates away;
      // resetting it here would only risk a flash of an enabled button an
      // instant before the stack transition completes.
    } catch {
      setSubmitError('Something went wrong generating your looks. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <StylistOutfitFormView
      anchorForm={anchorForm}
      stylistForm={stylistForm}
      isSubmitting={isSubmitting}
      submitError={submitError}
      onGenerate={() => void handleGenerate()}
    />
  );
}
