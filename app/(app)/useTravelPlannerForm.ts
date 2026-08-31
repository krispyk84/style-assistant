import { useCallback, useEffect, useRef, useState } from 'react';

import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { DestinationResult } from '@/services/destination';
import type { TravelClimateProfile } from '@/services/travel-climate';
import { inferTravelClimate } from '@/services/travel-climate';
import type { ClosetItem } from '@/types/closet';
import { buildTripDraft, calculateTripDays } from './travel-planner-mappers';
import type {
  JacketCount,
  ShoeCount,
  StyleVibe,
  TravelParty,
  TripPurpose,
  YesNo,
  YesNoUnsure,
} from './travel-planner-types';

export function useTravelPlannerForm() {
  const [destination, setDestination] = useState<DestinationResult | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [travelParty, setTravelParty] = useState<TravelParty>('Solo');
  const [purposes, setPurposes] = useState<TripPurpose[]>([]);

  const [climate, setClimate] = useState('');
  const [climateAutoFilled, setClimateAutoFilled] = useState(false);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateProfile, setClimateProfile] = useState<TravelClimateProfile | null>(null);
  const climateManualRef = useRef(false);
  const [climateRefreshToken, setClimateRefreshToken] = useState(0);

  const [activities, setActivities] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [styleVibe, setStyleVibe] = useState<StyleVibe>('Mix');
  const [willSwim, setWillSwim] = useState<YesNo>('No');
  const [fancyNights, setFancyNights] = useState<YesNo>('No');
  const [workoutClothes, setWorkoutClothes] = useState<YesNo>('No');
  const [laundryAccess, setLaundryAccess] = useState<YesNoUnsure>('Unsure');
  const [shoesCount, setShoesCount] = useState<ShoeCount>('2');
  const [jacketsCount, setJacketsCount] = useState<JacketCount>('1');
  const [carryOnOnly, setCarryOnOnly] = useState<YesNo>('No');
  const [rewearOk, setRewearOk] = useState<YesNo>('No');
  const [specialNeeds, setSpecialNeeds] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Wizard step (1: Trip, 2: Plans, 3: Context + Packing) — plain in-memory
  // state, not routed, so nothing unmounts and partial input survives normal
  // back/forward navigation within the creation flow.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const goNext = useCallback(() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s)), []);
  const goBack = useCallback(() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s)), []);

  useEffect(() => {
    const lat = destination?.lat;
    const lng = destination?.lng;
    if (lat == null || lng == null || !departureDate || !returnDate) return;
    if (climateManualRef.current) return;

    let cancelled = false;
    setClimateLoading(true);

    inferTravelClimate({ lat, lng, departureDate, returnDate })
      .then((profile) => {
        if (cancelled || climateManualRef.current) return;
        setClimate(profile.climateLabel);
        setClimateProfile(profile);
        setClimateAutoFilled(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setClimateLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    destination?.id,
    destination?.lat,
    destination?.lng,
    departureDate,
    returnDate,
    climateRefreshToken,
  ]);

  const togglePurpose = useCallback((value: TripPurpose) => {
    setPurposes((prev) => prev.includes(value) ? prev.filter((purpose) => purpose !== value) : [...prev, value]);
  }, []);

  const handleClimateChange = useCallback((text: string) => {
    setClimate(text);
    climateManualRef.current = true;
    if (climateAutoFilled) setClimateAutoFilled(false);
  }, [climateAutoFilled]);

  const handleClimateRefresh = useCallback(() => {
    climateManualRef.current = false;
    setClimateAutoFilled(false);
    setClimateRefreshToken((token) => token + 1);
  }, []);

  const resetForm = useCallback(() => {
    setDestination(null);
    setDepartureDate(null);
    setReturnDate(null);
    setTravelParty('Solo');
    setPurposes([]);
    setClimate('');
    setClimateAutoFilled(false);
    setClimateProfile(null);
    climateManualRef.current = false;
    setActivities('');
    setDressCode('');
    setStyleVibe('Mix');
    setWillSwim('No');
    setFancyNights('No');
    setWorkoutClothes('No');
    setLaundryAccess('Unsure');
    setShoesCount('2');
    setJacketsCount('1');
    setCarryOnOnly('No');
    setRewearOk('No');
    setSpecialNeeds('');
    setSubmitError(null);
    setStep(1);
  }, []);

  const numDays = calculateTripDays(departureDate, returnDate);
  const exceedsMaxDays = numDays > 8;
  const canSubmit = destination !== null && departureDate !== null && returnDate !== null && !isSubmitting && !exceedsMaxDays;
  // Step 1's own Continue gate — only destination + dates are required; travelling-with has a default.
  const canContinueStep1 = destination !== null && departureDate !== null && returnDate !== null && !exceedsMaxDays;

  const saveDraft = useCallback(async (options?: { wantToBring?: ClosetItem[] }) => {
    if (!destination || !departureDate || !returnDate) return false;

    if (exceedsMaxDays) {
      setSubmitError('Trips can be up to 8 days long right now.');
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const draft = buildTripDraft({
        destination,
        departureDate,
        returnDate,
        numDays,
        travelParty,
        purposes,
        climate,
        climateProfile,
        activities,
        dressCode,
        styleVibe,
        willSwim,
        fancyNights,
        workoutClothes,
        laundryAccess,
        shoesCount,
        jacketsCount,
        carryOnOnly,
        rewearOk,
        specialNeeds,
      });
      if (options?.wantToBring && options.wantToBring.length > 0) {
        draft.pendingAnchors = options.wantToBring.map((item) => ({
          label: item.title,
          category: item.category,
          source: 'closet' as const,
          closetItemId: item.id,
          rationale: 'Selected as a must-bring piece',
        }));
      }
      await tripDraftStorage.save(draft);
      return true;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activities,
    carryOnOnly,
    rewearOk,
    climate,
    climateProfile,
    departureDate,
    destination,
    dressCode,
    exceedsMaxDays,
    fancyNights,
    laundryAccess,
    numDays,
    purposes,
    returnDate,
    shoesCount,
    jacketsCount,
    specialNeeds,
    styleVibe,
    travelParty,
    willSwim,
    workoutClothes,
  ]);

  return {
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
    jacketsCount,
    setJacketsCount,
    carryOnOnly,
    setCarryOnOnly,
    rewearOk,
    setRewearOk,
    specialNeeds,
    setSpecialNeeds,
    isSubmitting,
    submitError,
    numDays,
    exceedsMaxDays,
    canSubmit,
    canContinueStep1,
    step,
    goNext,
    goBack,
    resetForm,
    saveDraft,
  };
}
