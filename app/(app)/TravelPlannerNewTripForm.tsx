import { ActivityIndicator, Pressable, View } from 'react-native';

import { DestinationAutocomplete } from '@/components/forms/destination-autocomplete';
import { TravelDatePicker } from '@/components/forms/travel-date-picker';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextInput } from '@/components/ui/text-input';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Card, ChipGrid, FieldLabel } from './travel-planner-primitives';
import type { useTravelPlannerForm } from './useTravelPlannerForm';
import {
  PURPOSES,
  type ShoeCount,
  type StyleVibe,
  type TravelParty,
  type YesNo,
  type YesNoUnsure,
} from './travel-planner-types';

// ── Props ─────────────────────────────────────────────────────────────────────

type TravelPlannerNewTripFormProps = {
  form: ReturnType<typeof useTravelPlannerForm>;
  onSubmit: () => void;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function TravelPlannerNewTripForm({ form, onSubmit }: TravelPlannerNewTripFormProps) {
  const { theme } = useTheme();
  const {
    destination, setDestination,
    departureDate, setDepartureDate,
    returnDate, setReturnDate,
    travelParty, setTravelParty,
    purposes, togglePurpose,
    climate, climateAutoFilled, climateLoading, handleClimateChange, handleClimateRefresh,
    activities, setActivities,
    dressCode, setDressCode,
    styleVibe, setStyleVibe,
    willSwim, setWillSwim,
    fancyNights, setFancyNights,
    workoutClothes, setWorkoutClothes,
    laundryAccess, setLaundryAccess,
    shoesCount, setShoesCount,
    carryOnOnly, setCarryOnOnly,
    specialNeeds, setSpecialNeeds,
    isSubmitting, submitError, exceedsMaxDays, canSubmit,
  } = form;

  return (
    <>
      {/* ── Trip Details ─────────────────────────────────────────────────── */}
      <Card>
        <AppText variant="sectionTitle">Trip Details</AppText>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Destination</FieldLabel>
          <DestinationAutocomplete value={destination} onChange={setDestination} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Travel Dates</FieldLabel>
          <TravelDatePicker
            departureDate={departureDate}
            returnDate={returnDate}
            onDepartureChange={setDepartureDate}
            onReturnChange={setReturnDate}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Travelling With</FieldLabel>
          <SegmentedControl<TravelParty>
            options={['Solo', 'Couple', 'Family', 'Group']}
            value={travelParty}
            onChange={setTravelParty}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Purpose of Trip</FieldLabel>
          <ChipGrid options={PURPOSES} values={purposes} onChange={togglePurpose} />
        </View>
      </Card>

      {/* ── Packing Context ──────────────────────────────────────────────── */}
      <Card>
        <AppText variant="sectionTitle">Packing Context</AppText>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Expected Weather / Climate</FieldLabel>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            placeholder={climateLoading ? 'Looking up…' : 'e.g. Warm and dry, cooler evenings'}
            value={climate}
            onChangeText={handleClimateChange}
          />
          {climateLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>
                Looking up typical climate…
              </AppText>
            </View>
          ) : climateAutoFilled ? (
            <Pressable
              onPress={handleClimateRefresh}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppIcon color={theme.colors.accent} name="sparkles" size={11} />
              <AppText
                style={{
                  color: theme.colors.accent,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 11,
                  letterSpacing: 0.4,
                }}>
                Suggested · Refresh
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Activities Planned</FieldLabel>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            multiline
            numberOfLines={3}
            placeholder="e.g. Hiking, city tours, beach days, business dinners"
            value={activities}
            onChangeText={setActivities}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Dress Code Expectations</FieldLabel>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            placeholder="e.g. Smart casual at the office, black tie Saturday"
            value={dressCode}
            onChangeText={setDressCode}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Style Vibe for This Trip</FieldLabel>
          <SegmentedControl<StyleVibe>
            options={['Relaxed', 'Smart Cas', 'Polished', 'Mix']}
            value={styleVibe}
            onChange={setStyleVibe}
          />
        </View>
      </Card>

      {/* ── Smart Packing ─────────────────────────────────────────────────── */}
      <Card>
        <AppText variant="sectionTitle">Smart Packing</AppText>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Planning to Swim?</FieldLabel>
          <SegmentedControl<YesNo> options={['Yes', 'No']} value={willSwim} onChange={setWillSwim} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Any Fancy Nights Out?</FieldLabel>
          <SegmentedControl<YesNo> options={['Yes', 'No']} value={fancyNights} onChange={setFancyNights} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Need Workout Clothes?</FieldLabel>
          <SegmentedControl<YesNo> options={['Yes', 'No']} value={workoutClothes} onChange={setWorkoutClothes} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Laundry Access?</FieldLabel>
          <SegmentedControl<YesNoUnsure>
            options={['Yes', 'No', 'Unsure']}
            value={laundryAccess}
            onChange={setLaundryAccess}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Shoes Willing to Bring</FieldLabel>
          <SegmentedControl<ShoeCount>
            options={['1', '2', '3', '4+']}
            value={shoesCount}
            onChange={setShoesCount}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Carry-On Only?</FieldLabel>
          <SegmentedControl<YesNo> options={['Yes', 'No']} value={carryOnOnly} onChange={setCarryOnOnly} />
        </View>
      </Card>

      {/* ── Additional Notes ─────────────────────────────────────────────── */}
      <Card>
        <AppText variant="sectionTitle">Additional Notes</AppText>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Special Packing Needs</FieldLabel>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            multiline
            numberOfLines={3}
            placeholder="e.g. Medications, fragile items, costume for themed event"
            value={specialNeeds}
            onChangeText={setSpecialNeeds}
          />
        </View>
      </Card>

      {/* Submit */}
      {submitError ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
          {submitError}
        </AppText>
      ) : null}
      {exceedsMaxDays && (
        <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
          Trips can be up to 8 days long right now.
        </AppText>
      )}
      <PrimaryButton
        disabled={!canSubmit}
        label={isSubmitting ? 'Saving…' : 'Choose Anchors →'}
        onPress={onSubmit}
      />
    </>
  );
}
