import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BrandSplash } from '@/components/ui/brand-splash';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectorCard } from '@/components/ui/selector-card';
import { SelectorGrid, type SelectorOption } from '@/components/ui/selector-grid';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';
import { useToast } from '@/components/ui/toast-provider';
import { trackOnboardingStarted, trackOnboardingCompleted } from '@/lib/analytics';
import type { Profile } from '@/types/profile';
import {
  BUDGET_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
} from '@/types/profile';

// ── Assets ─────────────────────────────────────────────────────────────────────

const vittorio = require('@/assets/images/vittorio.png');
const alessandra = require('@/assets/images/alessandra.png');

const FIT_IMAGES_MEN = {
  slim: require('@/assets/images/menswear_slim.png'),
  tailored: require('@/assets/images/menswear_tailored.png'),
  regular: require('@/assets/images/menswear_regular.png'),
  relaxed: require('@/assets/images/menswear_relaxed.png'),
};

const FIT_IMAGES_WOMEN = {
  slim: require('@/assets/images/womenswear_slim.png'),
  tailored: require('@/assets/images/womenswear_tailored.png'),
  regular: require('@/assets/images/womenswear_regular.png'),
  relaxed: require('@/assets/images/womenswear_relaxed.png'),
};

const BOTTOMS_IMAGES_MEN = {
  'shorts-ok': require('@/assets/images/menswear_shorts.png'),
  'prefer-trousers': require('@/assets/images/menswear_trousers.png'),
};

const STYLE_IMAGES_MEN = {
  minimal: require('@/assets/images/menswear_minimal.png'),
  classic: require('@/assets/images/menswear_classic.png'),
  streetwear: require('@/assets/images/menswear_streetwear.png'),
  'smart-casual': require('@/assets/images/menswear_smartcasual.png'),
  editorial: require('@/assets/images/menswear_editorial.png'),
};

const STYLE_IMAGES_WOMEN = {
  minimal: require('@/assets/images/womenswear_minimal.png'),
  classic: require('@/assets/images/womenswear_classic.png'),
  streetwear: require('@/assets/images/womenswear_streetwear.png'),
  'smart-casual': require('@/assets/images/womenswear_smartcasual.png'),
  editorial: require('@/assets/images/womenswear_editorial.png'),
};

// Gender-conditional budget images
const BUDGET_IMAGES_MEN = {
  budget: require('@/assets/images/menswear_budget.png'),
  'mid-range': require('@/assets/images/menswear_midrange.png'),
  premium: require('@/assets/images/menswear_premium.png'),
  luxury: require('@/assets/images/menswear_luxury.png'),
};

const BUDGET_IMAGES_WOMEN = {
  budget: require('@/assets/images/womenswear_budget.png'),
  'mid-range': require('@/assets/images/womenswear_midrange.png'),
  premium: require('@/assets/images/womenswear_premium.png'),
  luxury: require('@/assets/images/womenswear_luxury.png'),
};

// Temperature unit images (gender-independent)
const TEMP_IMAGES = {
  celsius: require('@/assets/images/degrees_c.png'),
  fahrenheit: require('@/assets/images/degrees_f.png'),
};

// ── Thumbnail helpers ──────────────────────────────────────────────────────────

const HAIR_SWATCHES: Record<string, string> = {
  black: '#1A1A1A',
  brown: '#6B3E2E',
  blonde: '#D4A840',
  red: '#A0412D',
  gray: '#9E9E9E',
  other: '#C8BDB6',
};

const SKIN_SWATCHES: Record<string, string> = {
  fair: '#FDDBB4',
  light: '#F3C99F',
  medium: '#D9956E',
  olive: '#C68642',
  deep: '#7D4F3A',
  black: '#3B1F0E',
};

function colorSwatch(color: string): ReactNode {
  return (
    <View
      style={{
        backgroundColor: color,
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: 999,
        borderWidth: 1,
        height: 52,
        width: 52,
      }}
    />
  );
}

// ── Step definitions ───────────────────────────────────────────────────────────

type WizardProfile = Partial<Omit<Profile, 'heightCm' | 'weightKg' | 'name' | 'notes'>> & {
  name: string;
  heightCm: string;
  weightKg: string;
  notes: string;
};

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

const STEPS = [
  'name',
  'gender',
  'measurements',
  'fit',
  'style',
  'budget',
  'hair',
  'skin',
  'bottoms',
  'temperature',
  'notes',
] as const;

type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  name: 'What should we\ncall you?',
  gender: 'How do you\nidentify?',
  measurements: 'Your\nmeasurements.',
  fit: 'How do you like\nclothes to fit?',
  style: 'Pick your overall\nstyle direction.',
  budget: "What's your\nbudget range?",
  hair: "What's your\nhair color?",
  skin: "What's your\nskin tone?",
  bottoms: 'Warm weather\nbottoms.',
  temperature: 'Temperature\npreference.',
  notes: 'Anything\nelse?',
};

const STEP_HINTS: Record<Step, string> = {
  name: '',
  gender: '',
  measurements: 'Used to calibrate fit recommendations.',
  fit: 'How you want clothes to sit on the body.',
  style: 'Pick the closest overall direction.',
  budget: 'Helps recommendations stay realistic.',
  hair: 'Useful for palette and contrast cues.',
  skin: 'Used for color guidance.',
  bottoms: 'Choose whether summer looks can include shorts.',
  temperature: 'Your preferred unit across the app.',
  notes: 'Optional context like profession or climate.',
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { isHydrated, isSaving, saveProfile, hasCompletedOnboarding } = useAppSession();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    trackOnboardingStarted();
  }, []);

  // Measurement units — default ft/lbs
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('ft');

  // ft/in fields — start empty; defaults shown as placeholder text
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');

  const [profile, setProfile] = useState<WizardProfile>({
    name: '',
    heightCm: '',
    weightKg: '',
    notes: '',
  });

  if (!isHydrated) {
    return (
      <BrandSplash
        messages={[
          'Preparing your Vesture onboarding.',
          'Loading your profile details.',
          'Getting your style setup ready.',
        ]}
      />
    );
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/(app)/home" />;
  }

  const steps = profile.gender === 'man' ? STEPS : STEPS.filter((s) => s !== 'bottoms');
  const step = steps[stepIndex];
  const totalSteps = steps.length;

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function advance() {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
      scrollToTop();
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      scrollToTop();
    } else {
      router.back();
    }
  }

  function selectAndAdvance<K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setTimeout(advance, 160);
  }

  function handleGenderSelect(gender: Profile['gender']) {
    setProfile((p) => ({ ...p, gender }));
    setTimeout(advance, 160);
  }

  // Resolved cm/kg values for final save — always whole numbers.
  function resolvedHeightCm(): string {
    if (heightUnit === 'ft') {
      const feet = parseFloat(heightFeet) || 0;
      const inches = parseFloat(heightInches) || 0;
      const totalInches = feet * 12 + inches;
      return totalInches > 0 ? String(Math.round(totalInches * 2.54)) : '';
    }
    return profile.heightCm;
  }

  function resolvedWeightKg(): string {
    if (weightUnit === 'lbs') {
      const lbs = parseFloat(profile.weightKg);
      return lbs > 0 ? String(Math.round(lbs / 2.20462)) : '';
    }
    return profile.weightKg;
  }

  // Per-step advance validators for required fields
  function handleNameContinue() {
    if (!profile.name.trim()) {
      showToast('Please enter your name to continue.', 'error');
      return;
    }
    advance();
  }

  function handleMeasurementsContinue() {
    const hCm = resolvedHeightCm();
    const wKg = resolvedWeightKg();
    if (!hCm || parseFloat(hCm) <= 0) {
      showToast('Please enter your height to continue.', 'error');
      return;
    }
    if (!wKg || parseFloat(wKg) <= 0) {
      showToast('Please enter your weight to continue.', 'error');
      return;
    }
    advance();
  }

  async function handleComplete() {
    // Final safety-net check (measurements step validates too, but guard here as well)
    const heightCm = resolvedHeightCm();
    const weightKg = resolvedWeightKg();

    if (!heightCm || parseFloat(heightCm) <= 0) {
      setStepIndex(steps.indexOf('measurements'));
      scrollToTop();
      showToast('Please enter your height to continue.', 'error');
      return;
    }
    if (!weightKg || parseFloat(weightKg) <= 0) {
      setStepIndex(steps.indexOf('measurements'));
      scrollToTop();
      showToast('Please enter your weight to continue.', 'error');
      return;
    }

    const finalProfile: Profile = {
      name: profile.name.trim(),
      gender: profile.gender ?? 'man',
      heightCm,
      weightKg,
      fitPreference: profile.fitPreference ?? 'tailored',
      stylePreference: profile.stylePreference ?? 'smart-casual',
      budget: profile.budget ?? 'premium',
      hairColor: profile.hairColor ?? 'brown',
      skinTone: profile.skinTone ?? 'medium',
      summerBottomPreference: profile.gender === 'man'
        ? (profile.summerBottomPreference ?? 'prefer-trousers')
        : 'prefer-trousers',
      temperatureUnit: profile.temperatureUnit ?? 'celsius',
      notes: profile.notes,
    };

    const saved = await saveProfile(finalProfile, true);
    if (saved) {
      trackOnboardingCompleted();
      router.replace('/(app)/home');
    } else {
      showToast('Profile could not be saved. Please try again.', 'error');
    }
  }

  // ── Option configs ───────────────────────────────────────────────────────────

  const fitImages = profile.gender === 'man' ? FIT_IMAGES_MEN : FIT_IMAGES_WOMEN;
  const fitOptions: SelectorOption<Profile['fitPreference']>[] = FIT_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: fitImages[v as keyof typeof fitImages],
  }));

  const styleImages = profile.gender === 'man' ? STYLE_IMAGES_MEN : STYLE_IMAGES_WOMEN;
  const styleOptions: SelectorOption<Profile['stylePreference']>[] = STYLE_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: styleImages[v as keyof typeof styleImages],
  }));

  // Budget images switch on gender (man vs everything else)
  const budgetImages = profile.gender === 'man' ? BUDGET_IMAGES_MEN : BUDGET_IMAGES_WOMEN;
  const budgetOptions: SelectorOption<Profile['budget']>[] = BUDGET_OPTIONS.map((v) => ({
    value: v,
    image: budgetImages[v as keyof typeof budgetImages],
  }));

  const hairOptions: SelectorOption<Profile['hairColor']>[] = HAIR_COLOR_OPTIONS.map((v) => ({
    value: v,
    thumbnailContent: colorSwatch(HAIR_SWATCHES[v] ?? theme.colors.border),
  }));

  const skinOptions: SelectorOption<Profile['skinTone']>[] = SKIN_TONE_OPTIONS.map((v) => ({
    value: v,
    thumbnailContent: colorSwatch(SKIN_SWATCHES[v] ?? theme.colors.border),
  }));

  const summerOptions: SelectorOption<Profile['summerBottomPreference']>[] = [
    { value: 'shorts-ok', label: 'Shorts OK', image: BOTTOMS_IMAGES_MEN['shorts-ok'] },
    { value: 'prefer-trousers', label: 'Prefer Trousers', image: BOTTOMS_IMAGES_MEN['prefer-trousers'] },
  ];

  const tempOptions: SelectorOption<Profile['temperatureUnit']>[] = [
    { value: 'celsius', label: '°C  Celsius', image: TEMP_IMAGES.celsius },
    { value: 'fahrenheit', label: '°F  Fahrenheit', image: TEMP_IMAGES.fahrenheit },
  ];

  // ── Step content ─────────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 'name':
        return (
          <View style={{ gap: spacing.lg }}>
            <TextInput
              autoCapitalize="words"
              autoComplete="given-name"
              autoCorrect={false}
              autoFocus
              textContentType="givenName"
              onChangeText={(v) => setProfile((p) => ({ ...p, name: v }))}
              placeholder="Your first name"
              placeholderTextColor={theme.colors.subtleText}
              returnKeyType="next"
              onSubmitEditing={handleNameContinue}
              style={inputStyle}
              value={profile.name}
            />
            <PrimaryButton label="Continue" onPress={handleNameContinue} />
          </View>
        );

      case 'gender':
        return (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
              {/* imageResizeMode="cover" fills the container and crops the bottom
                  of the portrait illustrations where character names appear */}
              <SelectorCard
                label="Man"
                selected={profile.gender === 'man'}
                onPress={() => handleGenderSelect('man')}
                image={vittorio}
                imageResizeMode="cover"
                thumbnailHeight={220}
              />
              <SelectorCard
                label="Woman"
                selected={profile.gender === 'woman'}
                onPress={() => handleGenderSelect('woman')}
                image={alessandra}
                imageResizeMode="cover"
                thumbnailHeight={220}
              />
            </View>
            <Pressable
              onPress={() => handleGenderSelect('non-binary')}
              hitSlop={12}
              style={{ paddingVertical: spacing.xs }}>
              <AppText
                style={{
                  color: profile.gender === 'non-binary' ? theme.colors.accent : theme.colors.subtleText,
                  fontFamily: profile.gender === 'non-binary' ? theme.fonts.sansMedium : theme.fonts.sans,
                  fontSize: 14,
                  textDecorationLine: 'underline',
                }}>
                Non-Binary / Prefer Not to Say
              </AppText>
            </Pressable>
          </View>
        );

      case 'measurements':
        return (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Height</AppText>
              <SegmentedControl
                options={['cm', 'ft']}
                value={heightUnit}
                onChange={(v) => {
                  setHeightUnit(v as HeightUnit);
                  setHasEditedMeasurements(true);
                }}
              />
              {heightUnit === 'cm' ? (
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    setProfile((p) => ({ ...p, heightCm: v.replace(/[^0-9]/g, '') }));
                  }}
                  placeholder="183"
                  placeholderTextColor={theme.colors.subtleText}
                  style={inputStyle}
                  value={profile.heightCm}
                />
              ) : (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(v) => {
                        setHeightFeet(v.replace(/[^0-9]/g, ''));
                      }}
                      placeholder="5"
                      placeholderTextColor={theme.colors.subtleText}
                      style={inputStyle}
                      value={heightFeet}
                    />
                    <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>feet</AppText>
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(v) => {
                        // Allow one decimal for values like 3.5"
                        setHeightInches(v.replace(/[^0-9.]/g, ''));
                      }}
                      placeholder="10"
                      placeholderTextColor={theme.colors.subtleText}
                      style={inputStyle}
                      value={heightInches}
                    />
                    <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center' }}>inches</AppText>
                  </View>
                </View>
              )}
            </View>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Weight</AppText>
              <SegmentedControl
                options={['kg', 'lbs']}
                value={weightUnit}
                onChange={(v) => setWeightUnit(v as WeightUnit)}
              />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(v) => {
                  setProfile((p) => ({ ...p, weightKg: v.replace(/[^0-9.]/g, '') }));
                }}
                placeholder={weightUnit === 'kg' ? '79' : '160'}
                placeholderTextColor={theme.colors.subtleText}
                style={inputStyle}
                value={profile.weightKg}
              />
            </View>
            <PrimaryButton label="Continue" onPress={handleMeasurementsContinue} />
          </View>
        );

      case 'fit':
        return (
          <SelectorGrid
            options={fitOptions}
            value={profile.fitPreference ?? null}
            onChange={(v) => selectAndAdvance('fitPreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'style':
        return (
          <SelectorGrid
            options={styleOptions}
            value={profile.stylePreference ?? null}
            onChange={(v) => selectAndAdvance('stylePreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'budget':
        return (
          <SelectorGrid
            options={budgetOptions}
            value={profile.budget ?? null}
            onChange={(v) => selectAndAdvance('budget', v)}
            thumbnailHeight={220}
          />
        );

      case 'hair':
        return (
          <SelectorGrid
            options={hairOptions}
            value={profile.hairColor ?? null}
            onChange={(v) => selectAndAdvance('hairColor', v)}
            thumbnailHeight={90}
          />
        );

      case 'skin':
        return (
          <SelectorGrid
            options={skinOptions}
            value={profile.skinTone ?? null}
            onChange={(v) => selectAndAdvance('skinTone', v)}
            thumbnailHeight={90}
          />
        );

      case 'bottoms':
        return (
          <SelectorGrid
            options={summerOptions}
            value={profile.summerBottomPreference ?? null}
            onChange={(v) => selectAndAdvance('summerBottomPreference', v)}
            thumbnailHeight={220}
          />
        );

      case 'temperature':
        return (
          <SelectorGrid
            options={tempOptions}
            value={profile.temperatureUnit ?? null}
            onChange={(v) => selectAndAdvance('temperatureUnit', v)}
            thumbnailHeight={120}
          />
        );

      case 'notes':
        return (
          <View style={{ gap: spacing.lg }}>
            <TextInput
              multiline
              numberOfLines={5}
              onChangeText={(v) => setProfile((p) => ({ ...p, notes: v }))}
              placeholder="e.g. I work in finance, live in a cold climate, and prefer understated style."
              placeholderTextColor={theme.colors.subtleText}
              style={[inputStyle, { minHeight: 140, paddingTop: spacing.md, textAlignVertical: 'top' }]}
              value={profile.notes}
            />
            <PrimaryButton
              label={isSaving ? 'Saving...' : 'Complete setup'}
              disabled={isSaving}
              onPress={handleComplete}
            />
          </View>
        );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header: back + progress */}
      <View
        style={{
          paddingTop: insets.top + spacing.xs,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <AppText tone="subtle" style={{ fontSize: 12 }}>
            {stepIndex + 1} / {totalSteps}
          </AppText>
        </View>

        {/* Progress bar */}
        <View style={{ backgroundColor: theme.colors.border, borderRadius: 99, height: 2 }}>
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: 99,
              height: 2,
              width: `${((stepIndex + 1) / totalSteps) * 100}%`,
            }}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl + insets.bottom }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.xl }}>
          {/* Question */}
          <View style={{ gap: spacing.xs }}>
            <AppText variant="hero" style={{ lineHeight: 44 }}>
              {STEP_TITLES[step]}
            </AppText>
            {STEP_HINTS[step] ? <AppText tone="muted">{STEP_HINTS[step]}</AppText> : null}
          </View>

          {/* Step content */}
          {renderStep()}
        </View>
      </ScrollView>
    </View>
  );
}

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 16,
  minHeight: 54,
  paddingHorizontal: spacing.md,
} as const;
