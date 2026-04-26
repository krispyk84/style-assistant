import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { SavedTripCard } from '@/components/cards/saved-trip-card';
import { DestinationAutocomplete } from '@/components/forms/destination-autocomplete';
import { TravelDatePicker } from '@/components/forms/travel-date-picker';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextInput } from '@/components/ui/text-input';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTripModeHref, buildTripResultsHref } from '@/lib/trip-route';
import type { SavedTripSummary } from '@/services/saved-trips';
import { useSavedTripsData } from './useSavedTripsData';
import { useTravelPlannerForm } from './useTravelPlannerForm';
import {
  PURPOSES,
  type PlannerTab,
  type ShoeCount,
  type StyleVibe,
  type TravelParty,
  type TripPurpose,
  type YesNo,
  type YesNoUnsure,
} from './travel-planner-types';

// ── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        gap: spacing.lg,
        padding: spacing.lg,
      }}>
      {children}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <AppText
      variant="eyebrow"
      style={{ color: theme.colors.mutedText, letterSpacing: 1.6, marginBottom: spacing.xs }}>
      {children}
    </AppText>
  );
}

function ChipGrid({
  options,
  values,
  onChange,
}: {
  options: TripPurpose[];
  values: TripPurpose[];
  onChange: (v: TripPurpose) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              backgroundColor: active ? theme.colors.text : theme.colors.subtleSurface,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
            }}>
            <AppText
              style={{
                color: active ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: active ? theme.fonts.sansMedium : theme.fonts.sans,
                fontSize: 13,
              }}>
              {opt}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TravelPlannerScreen() {
  const { theme } = useTheme();

  // Top-level tab
  const [activeTab, setActiveTab] = useState<PlannerTab>('new');

  // Set to true when we navigate to trip-anchors; on re-focus we reset the form
  const navigatedToAnchorsRef = useRef(false);

  const {
    savedTrips,
    savedTripsLoading,
    savedTripsError,
    pastExpanded,
    setPastExpanded,
    upcomingTrips,
    pastTrips,
    loadSavedTrips,
    deleteSavedTrip,
  } = useSavedTripsData();

  const plannerForm = useTravelPlannerForm();
  const {
    destination,
    setDestination,
    departureDate,
    setDepartureDate,
    returnDate,
    setReturnDate,
    travelParty,
    setTravelParty,
    purposes,
    togglePurpose,
    climate,
    climateAutoFilled,
    climateLoading,
    handleClimateChange,
    handleClimateRefresh,
    activities,
    setActivities,
    dressCode,
    setDressCode,
    styleVibe,
    setStyleVibe,
    willSwim,
    setWillSwim,
    fancyNights,
    setFancyNights,
    workoutClothes,
    setWorkoutClothes,
    laundryAccess,
    setLaundryAccess,
    shoesCount,
    setShoesCount,
    carryOnOnly,
    setCarryOnOnly,
    specialNeeds,
    setSpecialNeeds,
    isSubmitting,
    submitError,
    exceedsMaxDays,
    canSubmit,
    resetForm,
    saveDraft,
  } = plannerForm;

  // Reload saved trips whenever this screen comes into focus; reset form if returning from anchors
  useFocusEffect(
    useCallback(() => {
      loadSavedTrips();
      if (navigatedToAnchorsRef.current) {
        navigatedToAnchorsRef.current = false;
        resetForm();
      }
    }, [loadSavedTrips, resetForm])
  );

  function handleOpenSavedTrip(trip: SavedTripSummary) {
    router.push(buildTripResultsHref({
      tripId: trip.tripId,
      destination: trip.destination,
      savedTripId: trip.id,
    }));
  }


  async function handleSubmit() {
    const didSave = await saveDraft();
    if (!didSave) return;
    navigatedToAnchorsRef.current = true;
    router.push(buildTripModeHref());
  }

  return (
    <AppScreen scrollable backButton topInset>
      <View style={{ gap: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Travel Planner</AppText>
          <AppText tone="muted">Pack smart for every trip.</AppText>
        </View>

        {/* Segmented control */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            padding: 3,
          }}>
          {(['new', 'saved'] as PlannerTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isActive ? theme.colors.text : 'transparent',
                  borderRadius: 11,
                  flex: 1,
                  paddingVertical: spacing.sm,
                }}>
                <AppText
                  style={{
                    color: isActive ? theme.colors.inverseText : theme.colors.mutedText,
                    fontFamily: staticTheme.fonts.sansMedium,
                    fontSize: 13,
                    letterSpacing: 0.4,
                  }}>
                  {tab === 'new' ? 'New Trip' : 'Saved Trips'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* ── Saved Trips tab ──────────────────────────────────────────────── */}
        {activeTab === 'saved' && (
          savedTripsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <ActivityIndicator color={theme.colors.mutedText} />
            </View>
          ) : savedTripsError ? (
            <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
              {savedTripsError}
            </AppText>
          ) : savedTrips.length === 0 ? (
            <EmptyState
              title="No saved trips"
              message="Generate a trip plan and tap the bookmark to save it here."
            />
          ) : (
              <View style={{ gap: spacing.md }}>
                {/* Past trips toggle */}
                {pastTrips.length > 0 && (
                  <Pressable
                    onPress={() => setPastExpanded((v) => !v)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      paddingVertical: spacing.xs,
                    }}>
                    <AppIcon name="archive" color={theme.colors.mutedText} size={13} />
                    <AppText style={{
                      color: theme.colors.mutedText,
                      fontFamily: staticTheme.fonts.sansMedium,
                      fontSize: 13,
                      flex: 1,
                    }}>
                      {pastTrips.length} past {pastTrips.length === 1 ? 'trip' : 'trips'}
                    </AppText>
                    <AppIcon
                      name={pastExpanded ? 'chevron-up' : 'chevron-down'}
                      color={theme.colors.mutedText}
                      size={13}
                    />
                  </Pressable>
                )}

                {/* Past trips (expanded) */}
                {pastExpanded && pastTrips.map((trip) => (
                  <SavedTripCard
                    key={trip.id}
                    trip={trip}
                    onPress={() => handleOpenSavedTrip(trip)}
                    onDelete={() => deleteSavedTrip(trip.id)}
                  />
                ))}

                {/* Upcoming trips */}
                {upcomingTrips.length === 0 && pastTrips.length > 0 ? (
                  <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center', paddingVertical: spacing.md }}>
                    No upcoming trips saved.
                  </AppText>
                ) : (
                  upcomingTrips.map((trip) => (
                    <SavedTripCard
                      key={trip.id}
                      trip={trip}
                      onPress={() => handleOpenSavedTrip(trip)}
                      onDelete={() => deleteSavedTrip(trip.id)}
                    />
                  ))
                )}
              </View>
          )
        )}

        {/* ── New Trip form ─────────────────────────────────────────────────── */}
        {activeTab === 'new' && <>

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
            <SegmentedControl<YesNo>
              options={['Yes', 'No']}
              value={willSwim}
              onChange={setWillSwim}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <FieldLabel>Any Fancy Nights Out?</FieldLabel>
            <SegmentedControl<YesNo>
              options={['Yes', 'No']}
              value={fancyNights}
              onChange={setFancyNights}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <FieldLabel>Need Workout Clothes?</FieldLabel>
            <SegmentedControl<YesNo>
              options={['Yes', 'No']}
              value={workoutClothes}
              onChange={setWorkoutClothes}
            />
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
            <SegmentedControl<YesNo>
              options={['Yes', 'No']}
              value={carryOnOnly}
              onChange={setCarryOnOnly}
            />
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
          onPress={() => void handleSubmit()}
        />

        </>}

      </View>
    </AppScreen>
  );
}
