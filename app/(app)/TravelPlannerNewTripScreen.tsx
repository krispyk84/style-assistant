import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { DestinationAutocomplete } from '@/components/forms/destination-autocomplete';
import { TravelDatePicker } from '@/components/forms/travel-date-picker';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildTripModeHref } from '@/lib/trip-route';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import { Card, ChipGrid, FieldLabel } from './travel-planner-primitives';
import { useTravelPlannerForm } from './useTravelPlannerForm';
import { PURPOSES, type ShoeCount, type TravelParty, type YesNo, type YesNoUnsure } from './travel-planner-types';

const STEP_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Trip',
  2: 'Plans',
  3: 'Context & Packing',
};

export function TravelPlannerNewTripScreen() {
  const { theme } = useTheme();
  const form = useTravelPlannerForm();
  const {
    destination, setDestination,
    departureDate, setDepartureDate,
    returnDate, setReturnDate,
    travelParty, setTravelParty,
    purposes, togglePurpose,
    climate, climateAutoFilled, climateLoading, handleClimateRefresh,
    laundryAccess, setLaundryAccess,
    shoesCount, setShoesCount,
    carryOnOnly, setCarryOnOnly,
    rewearOk, setRewearOk,
    numDays, canContinueStep1, isSubmitting, submitError,
    step, goNext, goBack,
    saveDraft,
  } = form;

  const [wantToBring, setWantToBring] = useState<ClosetItem[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  function openClosetPicker() {
    setIsPickerOpen(true);
    if (closetItems.length === 0) {
      void closetService.getItems().then((res) => {
        if (res.success && res.data) setClosetItems(res.data.items);
      });
    }
  }

  function handlePickWantToBring(item: ClosetItem) {
    setWantToBring((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    setIsPickerOpen(false);
  }

  function removeWantToBring(id: string) {
    setWantToBring((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleFinishStep3() {
    const didSave = await saveDraft({ wantToBring });
    if (!didSave) return;
    router.push(buildTripModeHref());
  }

  function handleBack() {
    if (step === 1) {
      router.back();
      return;
    }
    goBack();
  }

  const canContinueCurrentStep = step === 1 ? canContinueStep1 : true;

  return (
    <AppScreen scrollable bounces={false}>
      <View style={{ gap: spacing.xl }}>
        {/* Header: back chevron + step progress */}
        <View style={{ gap: spacing.sm }}>
          <Pressable onPress={handleBack} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <AppIcon color={theme.colors.text} name="chevron-left" size={18} />
            <AppText style={{ fontSize: 15 }}>Back</AppText>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: s <= step ? theme.colors.text : theme.colors.border,
                  borderRadius: 2,
                  flex: 1,
                  height: 3,
                }}
              />
            ))}
          </View>
          <AppText variant="heroSmall">{STEP_TITLES[step]}</AppText>
        </View>

        {step === 1 ? (
          <Step1Trip
            destination={destination}
            setDestination={setDestination}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            returnDate={returnDate}
            setReturnDate={setReturnDate}
            numDays={numDays}
            travelParty={travelParty}
            setTravelParty={setTravelParty}
          />
        ) : null}

        {step === 2 ? (
          <Step2Plans purposes={purposes} togglePurpose={togglePurpose} />
        ) : null}

        {step === 3 ? (
          <Step3Context
            destinationLabel={destination?.label ?? ''}
            departureDate={departureDate}
            returnDate={returnDate}
            numDays={numDays}
            travelParty={travelParty}
            climate={climate}
            climateAutoFilled={climateAutoFilled}
            climateLoading={climateLoading}
            onClimateRefresh={handleClimateRefresh}
            carryOnOnly={carryOnOnly}
            setCarryOnOnly={setCarryOnOnly}
            laundryAccess={laundryAccess}
            setLaundryAccess={setLaundryAccess}
            rewearOk={rewearOk}
            setRewearOk={setRewearOk}
            shoesCount={shoesCount}
            setShoesCount={setShoesCount}
            wantToBring={wantToBring}
            onAddWantToBring={openClosetPicker}
            onRemoveWantToBring={removeWantToBring}
          />
        ) : null}

        {submitError ? (
          <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>{submitError}</AppText>
        ) : null}

        <PrimaryButton
          disabled={!canContinueCurrentStep || isSubmitting}
          label={isSubmitting ? 'Saving…' : 'Continue'}
          onPress={() => (step < 3 ? goNext() : void handleFinishStep3())}
        />
      </View>

      <ClosetPickerModal
        visible={isPickerOpen}
        items={closetItems.filter((item) => !wantToBring.some((i) => i.id === item.id))}
        onSelect={handlePickWantToBring}
        onClose={() => setIsPickerOpen(false)}
      />
    </AppScreen>
  );
}

// ── Step 1: Trip ────────────────────────────────────────────────────────────────

function Step1Trip({
  destination, setDestination,
  departureDate, setDepartureDate,
  returnDate, setReturnDate,
  numDays,
  travelParty, setTravelParty,
}: {
  destination: ReturnType<typeof useTravelPlannerForm>['destination'];
  setDestination: ReturnType<typeof useTravelPlannerForm>['setDestination'];
  departureDate: Date | null;
  setDepartureDate: (d: Date | null) => void;
  returnDate: Date | null;
  setReturnDate: (d: Date | null) => void;
  numDays: number;
  travelParty: TravelParty;
  setTravelParty: (v: TravelParty) => void;
}) {
  return (
    <Card>
      <View style={{ gap: spacing.xs }}>
        <FieldLabel>Where are you going?</FieldLabel>
        <DestinationAutocomplete value={destination} onChange={setDestination} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <FieldLabel>When?</FieldLabel>
        <TravelDatePicker
          departureDate={departureDate}
          returnDate={returnDate}
          onDepartureChange={setDepartureDate}
          onReturnChange={setReturnDate}
        />
        {departureDate && returnDate ? (
          <AppText tone="muted" style={{ fontSize: 12 }}>
            {numDays} day{numDays === 1 ? '' : 's'}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <FieldLabel>Travelling with</FieldLabel>
        <SegmentedControl<TravelParty>
          options={['Solo', 'Couple', 'Family', 'Group']}
          value={travelParty}
          onChange={setTravelParty}
        />
      </View>
    </Card>
  );
}

// ── Step 2: Plans ─────────────────────────────────────────────────────────────

function Step2Plans({
  purposes,
  togglePurpose,
}: {
  purposes: string[];
  togglePurpose: (v: string) => void;
}) {
  return (
    <Card>
      <View style={{ gap: spacing.xs }}>
        <FieldLabel>What will you be doing?</FieldLabel>
        <AppText tone="muted" style={{ fontSize: 12, marginBottom: spacing.xs }}>
          Pick as many as apply — this tells the stylist what formality and pieces to plan for.
        </AppText>
        <ChipGrid
          options={PURPOSES}
          values={purposes}
          onChange={togglePurpose}
          onAddCustom={togglePurpose}
        />
      </View>
    </Card>
  );
}

// ── Step 3: Context + Packing ─────────────────────────────────────────────────

function Step3Context({
  destinationLabel,
  departureDate,
  returnDate,
  numDays,
  travelParty,
  climate,
  climateAutoFilled,
  climateLoading,
  onClimateRefresh,
  carryOnOnly,
  setCarryOnOnly,
  laundryAccess,
  setLaundryAccess,
  rewearOk,
  setRewearOk,
  shoesCount,
  setShoesCount,
  wantToBring,
  onAddWantToBring,
  onRemoveWantToBring,
}: {
  destinationLabel: string;
  departureDate: Date | null;
  returnDate: Date | null;
  numDays: number;
  travelParty: TravelParty;
  climate: string;
  climateAutoFilled: boolean;
  climateLoading: boolean;
  onClimateRefresh: () => void;
  carryOnOnly: YesNo;
  setCarryOnOnly: (v: YesNo) => void;
  laundryAccess: YesNoUnsure;
  setLaundryAccess: (v: YesNoUnsure) => void;
  rewearOk: YesNo;
  setRewearOk: (v: YesNo) => void;
  shoesCount: ShoeCount;
  setShoesCount: (v: ShoeCount) => void;
  wantToBring: ClosetItem[];
  onAddWantToBring: () => void;
  onRemoveWantToBring: (id: string) => void;
}) {
  const { theme } = useTheme();
  const dateRangeLabel =
    departureDate && returnDate
      ? `${departureDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${returnDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${numDays} day${numDays === 1 ? '' : 's'}`
      : '';

  return (
    <>
      {/* Trip summary */}
      <Card>
        <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 18 }}>{destinationLabel}</AppText>
        <AppText tone="muted" style={{ fontSize: 13, marginTop: -spacing.sm }}>{dateRangeLabel}</AppText>
        <AppText tone="muted" style={{ fontSize: 13, marginTop: -spacing.sm }}>{travelParty}</AppText>

        {/* Auto-inferred context — only shown when we actually have it (no invented values) */}
        {climateLoading ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
            <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>Checking typical weather…</AppText>
          </View>
        ) : climate ? (
          <View style={{ gap: 4 }}>
            <FieldLabel>What to expect</FieldLabel>
            <AppText style={{ fontSize: 13 }}>{climate}</AppText>
            {climateAutoFilled ? (
              <Pressable onPress={onClimateRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AppIcon color={theme.colors.accent} name="sparkles" size={11} />
                <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 11 }}>
                  Suggested · Refresh
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Card>

      {/* Packing preferences */}
      <Card>
        <AppText variant="sectionTitle">Packing preferences</AppText>

        <PackingCheckbox
          label="Carry-on only"
          checked={carryOnOnly === 'Yes'}
          onToggle={() => setCarryOnOnly(carryOnOnly === 'Yes' ? 'No' : 'Yes')}
        />
        <PackingCheckbox
          label="Happy to rewear pieces"
          checked={rewearOk === 'Yes'}
          onToggle={() => setRewearOk(rewearOk === 'Yes' ? 'No' : 'Yes')}
        />

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Laundry available?</FieldLabel>
          <SegmentedControl<YesNoUnsure> options={['Yes', 'No', 'Unsure']} value={laundryAccess} onChange={setLaundryAccess} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <FieldLabel>Shoes willing to bring</FieldLabel>
          <SegmentedControl<ShoeCount> options={['1', '2', '3', '4+']} value={shoesCount} onChange={setShoesCount} />
        </View>
      </Card>

      {/* Anything you definitely want to bring */}
      <Card>
        <FieldLabel>Anything you definitely want to bring?</FieldLabel>
        {wantToBring.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wantToBring.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onRemoveWantToBring(item.id)}
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm - 2,
                }}>
                <AppText style={{ fontSize: 13 }}>{item.title}</AppText>
                <AppIcon color={theme.colors.subtleText} name="close" size={12} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={onAddWantToBring}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            paddingVertical: spacing.sm,
          }}>
          <AppIcon color={theme.colors.text} name="add" size={13} />
          <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>Add from closet</AppText>
        </Pressable>
      </Card>
    </>
  );
}

function PackingCheckbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onToggle} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: checked ? theme.colors.text : 'transparent',
          borderColor: checked ? theme.colors.text : theme.colors.border,
          borderRadius: 6,
          borderWidth: 1.5,
          height: 22,
          justifyContent: 'center',
          width: 22,
        }}>
        {checked ? <AppIcon color={theme.colors.inverseText} name="check" size={13} /> : null}
      </View>
      <AppText style={{ fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}
