import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { DestinationAutocomplete } from '@/components/forms/destination-autocomplete';
import { TravelDatePicker } from '@/components/forms/travel-date-picker';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextInput } from '@/components/ui/text-input';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import type { DestinationResult } from '@/services/destination';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TravelClimateProfile } from '@/services/travel-climate';
import { inferTravelClimate } from '@/services/travel-climate';

// ── Types ────────────────────────────────────────────────────────────────────

type YesNo = 'Yes' | 'No';
type YesNoUnsure = 'Yes' | 'No' | 'Unsure';
type TravelParty = 'Solo' | 'Couple' | 'Family' | 'Group';
type ShoeCount = '1' | '2' | '3' | '4+';
type StyleVibe = 'Relaxed' | 'Smart Cas' | 'Polished' | 'Mix';

type TripPurpose =
  | 'Business'
  | 'Conference'
  | 'Leisure'
  | 'Wedding / Event'
  | 'Beach / Resort'
  | 'Adventure';

const PURPOSES: TripPurpose[] = [
  'Business',
  'Conference',
  'Leisure',
  'Wedding / Event',
  'Beach / Resort',
  'Adventure',
];

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

  // Trip details
  const [destination, setDestination] = useState<DestinationResult | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [travelParty, setTravelParty] = useState<TravelParty>('Solo');
  const [purposes, setPurposes] = useState<TripPurpose[]>([]);

  function togglePurpose(v: TripPurpose) {
    setPurposes((prev) => prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]);
  }

  // Packing context — climate is auto-filled from destination + dates
  const [climate, setClimate] = useState('');
  const [climateAutoFilled, setClimateAutoFilled] = useState(false);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateProfile, setClimateProfile] = useState<TravelClimateProfile | null>(null);
  // Tracks whether the user has manually edited the climate field.
  // Using a ref so it doesn't re-trigger the inference effect on every keystroke.
  const climateManualRef = useRef(false);
  // Incrementing this forces a re-fetch even after manual edits.
  const [climateRefreshToken, setClimateRefreshToken] = useState(0);

  const [activities, setActivities] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [styleVibe, setStyleVibe] = useState<StyleVibe>('Mix');


  // Smart packing
  const [willSwim, setWillSwim] = useState<YesNo>('No');
  const [fancyNights, setFancyNights] = useState<YesNo>('No');
  const [workoutClothes, setWorkoutClothes] = useState<YesNo>('No');
  const [laundryAccess, setLaundryAccess] = useState<YesNoUnsure>('Unsure');
  const [shoesCount, setShoesCount] = useState<ShoeCount>('2');
  const [carryOnOnly, setCarryOnOnly] = useState<YesNo>('No');

  // Notes
  const [specialNeeds, setSpecialNeeds] = useState('');

  // ── Climate auto-fill ─────────────────────────────────────────────────────

  useEffect(() => {
    const lat = destination?.lat;
    const lng = destination?.lng;
    if (lat == null || lng == null || !departureDate || !returnDate) return;
    if (climateManualRef.current) return; // Respect manual edits

    let cancelled = false;
    setClimateLoading(true);

    inferTravelClimate({ lat, lng, departureDate, returnDate })
      .then((profile) => {
        if (cancelled || climateManualRef.current) return;
        setClimate(profile.climateLabel);
        setClimateProfile(profile);
        setClimateAutoFilled(true);
      })
      .catch(() => {}) // Fail silently — field stays editable and empty
      .finally(() => {
        if (!cancelled) setClimateLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    destination?.geonameId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    departureDate?.getTime(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    returnDate?.getTime(),
    climateRefreshToken,
  ]);

  function handleClimateChange(text: string) {
    setClimate(text);
    climateManualRef.current = true;
    if (climateAutoFilled) setClimateAutoFilled(false);
  }

  function handleClimateRefresh() {
    climateManualRef.current = false;
    setClimateAutoFilled(false);
    setClimateRefreshToken((t) => t + 1);
  }

  // ─────────────────────────────────────────────────────────────────────────

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = destination !== null && departureDate !== null && returnDate !== null && !isSubmitting;

  function toISODate(d: Date): string {
    return d.toISOString().split('T')[0]!;
  }

  async function handleSubmit() {
    if (!destination || !departureDate || !returnDate) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const tripId = `trip-${Date.now()}`;

    try {
      const result = await tripOutfitsService.generateTripOutfits({
        tripId,
        destination: destination.label,
        country: destination.country,
        departureDate: toISODate(departureDate),
        returnDate: toISODate(returnDate),
        travelParty,
        purposes,
        climateLabel: climate || 'Not specified',
        avgHighC: climateProfile?.avgHighC,
        avgLowC: climateProfile?.avgLowC,
        tempBand: climateProfile?.tempBand,
        precipChar: climateProfile?.precipChar,
        packingTag: climateProfile?.packingTag,
        dressSeason: climateProfile?.dressSeason,
        activities: activities.trim() || undefined,
        dressCode: dressCode.trim() || undefined,
        styleVibe,
        willSwim: willSwim === 'Yes',
        fancyNights: fancyNights === 'Yes',
        workoutClothes: workoutClothes === 'Yes',
        laundryAccess,
        shoesCount,
        carryOnOnly: carryOnOnly === 'Yes',
        specialNeeds: specialNeeds.trim() || undefined,
      });

      await tripOutfitsStorage.save({
        tripId,
        destination: destination.label,
        days: result.days,
        generatedAt: new Date().toISOString(),
      });

      router.push({
        pathname: '/(app)/trip-results',
        params: { tripId, destination: destination.label },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen scrollable backButton topInset>
      <View style={{ gap: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Travel Planner</AppText>
          <AppText tone="muted">Pack smart for every trip.</AppText>
        </View>

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
        <PrimaryButton
          disabled={!canSubmit}
          label={isSubmitting ? 'Building Your Plan…' : 'Build My Packing List'}
          onPress={() => void handleSubmit()}
        />

      </View>
    </AppScreen>
  );
}
