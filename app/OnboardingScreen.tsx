import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BrandSplash } from '@/components/ui/brand-splash';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectorCard } from '@/components/ui/selector-card';
import { SelectorGrid, type SelectorOption } from '@/components/ui/selector-grid';
import { spacing, theme } from '@/constants/theme';
import { trackOnboardingStarted } from '@/lib/analytics';
import type { Profile } from '@/types/profile';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FEMALE_BODY_TYPE_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS,
} from '@/types/profile';
import { useOnboardingFlow } from './useOnboardingFlow';
import { useOnboardingForms } from './useOnboardingForms';
import type { Step, WizardProfile } from './onboarding-mappers';

// ── Step labels ────────────────────────────────────────────────────────────────

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
  'body-type': 'Your\nbody type.',
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
  'body-type': 'Used to personalise outfit sketches.',
  temperature: 'Your preferred unit across the app.',
  notes: 'Optional context like profession or climate.',
};

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

const TEMP_IMAGES = {
  celsius: require('@/assets/images/degrees_c.png'),
  fahrenheit: require('@/assets/images/degrees_f.png'),
};

const BODY_TYPE_IMAGES = {
  slim: require('@/assets/images/menswear_bodytype_slim.png'),
  oval: require('@/assets/images/menswear_bodytype_oval.png'),
  rectangle: require('@/assets/images/menswear_bodytype_rectangle.png'),
  athletic: require('@/assets/images/menswear_bodytype_athletic.png'),
};

const BODY_TYPE_LABELS: Record<string, string> = {
  slim: 'Slim',
  oval: 'Oval',
  rectangle: 'Rectangle',
  athletic: 'Athletic',
};

const FEMALE_BODY_TYPE_IMAGES = {
  hourglass: require('@/assets/images/womenswear_bodytype_hourglass.png'),
  inverted_triangle: require('@/assets/images/womenswear_bodytype_inverted_triangle.png'),
  rectangle: require('@/assets/images/womenswear_bodytype_rectangle.png'),
  pear: require('@/assets/images/womenswear_bodytype_pear.png'),
  apple: require('@/assets/images/womenswear_bodytype_apple.png'),
  slim: require('@/assets/images/womenswear_bodytype_slim.png'),
};

const FEMALE_BODY_TYPE_LABELS: Record<string, string> = {
  hourglass: 'Hourglass',
  inverted_triangle: 'Inverted Triangle',
  rectangle: 'Rectangle',
  pear: 'Pear',
  apple: 'Apple',
  slim: 'Slim',
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

// ── Screen ─────────────────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const formsHook = useOnboardingForms();
  const flowHook = useOnboardingFlow({
    profile: formsHook.profile,
    heightUnit: formsHook.heightUnit,
    weightUnit: formsHook.weightUnit,
    heightFeet: formsHook.heightFeet,
    heightInches: formsHook.heightInches,
  });

  useEffect(() => {
    trackOnboardingStarted();
  }, []);

  // Scroll to top whenever the step changes (covers advance, goBack, and the
  // safety-net redirect inside handleComplete)
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [flowHook.stepIndex]);

  if (!flowHook.isHydrated) {
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

  if (flowHook.hasCompletedOnboarding) {
    return <Redirect href="/(app)/home" />;
  }

  // ── Coordinators ─────────────────────────────────────────────────────────────

  function selectAndAdvance<K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) {
    formsHook.setField(key, value);
    setTimeout(flowHook.advance, 160);
  }

  function handleGenderSelect(gender: Profile['gender']) {
    formsHook.setGender(gender);
    setTimeout(flowHook.advance, 160);
  }

  // ── Option configs ────────────────────────────────────────────────────────────

  const fitImages = formsHook.profile.gender === 'man' ? FIT_IMAGES_MEN : FIT_IMAGES_WOMEN;
  const fitOptions: SelectorOption<Profile['fitPreference']>[] = FIT_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: fitImages[v as keyof typeof fitImages],
  }));

  const styleImages = formsHook.profile.gender === 'man' ? STYLE_IMAGES_MEN : STYLE_IMAGES_WOMEN;
  const styleOptions: SelectorOption<Profile['stylePreference']>[] = STYLE_PREFERENCE_OPTIONS.map((v) => ({
    value: v,
    image: styleImages[v as keyof typeof styleImages],
  }));

  const budgetImages = formsHook.profile.gender === 'man' ? BUDGET_IMAGES_MEN : BUDGET_IMAGES_WOMEN;
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

  // ── Step content ──────────────────────────────────────────────────────────────

  function renderStep() {
    const { profile, weightUnit, heightUnit, heightFeet, heightInches } = formsHook;

    switch (flowHook.step) {
      case 'name':
        return (
          <View style={{ gap: spacing.lg }}>
            <TextInput
              autoCapitalize="words"
              autoComplete="given-name"
              autoCorrect={false}
              autoFocus
              textContentType="givenName"
              onChangeText={(v) => formsHook.setField('name', v)}
              placeholder="Your first name"
              placeholderTextColor={theme.colors.subtleText}
              returnKeyType="next"
              onSubmitEditing={() => { if (formsHook.validateName()) flowHook.advance(); }}
              style={inputStyle}
              value={profile.name}
            />
            <PrimaryButton
              label="Continue"
              onPress={() => { if (formsHook.validateName()) flowHook.advance(); }}
            />
          </View>
        );

      case 'gender':
        return (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
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
                onChange={(v) => formsHook.setHeightUnit(v as 'cm' | 'ft')}
              />
              {heightUnit === 'cm' ? (
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(v) => formsHook.setField('heightCm', v.replace(/[^0-9]/g, ''))}
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
                      onChangeText={(v) => formsHook.setHeightFeet(v.replace(/[^0-9]/g, ''))}
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
                      onChangeText={(v) => formsHook.setHeightInches(v.replace(/[^0-9.]/g, ''))}
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
                onChange={(v) => formsHook.setWeightUnit(v as 'kg' | 'lbs')}
              />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(v) => formsHook.setField('weightKg', v.replace(/[^0-9.]/g, ''))}
                placeholder={weightUnit === 'kg' ? '79' : '160'}
                placeholderTextColor={theme.colors.subtleText}
                style={inputStyle}
                value={profile.weightKg}
              />
            </View>
            <PrimaryButton
              label="Continue"
              onPress={() => { if (formsHook.validateMeasurements()) flowHook.advance(); }}
            />
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

      case 'body-type': {
        const isWoman = profile.gender === 'woman';
        const bodyTypeOptions = isWoman
          ? FEMALE_BODY_TYPE_OPTIONS.map((v) => ({
              value: v,
              label: FEMALE_BODY_TYPE_LABELS[v],
              image: FEMALE_BODY_TYPE_IMAGES[v],
            }))
          : BODY_TYPE_OPTIONS.map((v) => ({
              value: v,
              label: BODY_TYPE_LABELS[v],
              image: BODY_TYPE_IMAGES[v],
            }));
        return (
          <SelectorGrid
            options={bodyTypeOptions}
            value={profile.bodyType ?? null}
            onChange={(v) => selectAndAdvance('bodyType', v)}
            thumbnailHeight={220}
          />
        );
      }


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
              onChangeText={(v) => formsHook.setField('notes', v)}
              placeholder="e.g. I work in finance, live in a cold climate, and prefer understated style."
              placeholderTextColor={theme.colors.subtleText}
              style={[inputStyle, { minHeight: 140, paddingTop: spacing.md, textAlignVertical: 'top' }]}
              value={profile.notes}
            />
            <PrimaryButton
              label={flowHook.isSaving ? 'Saving...' : 'Complete setup'}
              disabled={flowHook.isSaving}
              onPress={() => void flowHook.handleComplete()}
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
          <Pressable onPress={flowHook.goBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <AppText tone="subtle" style={{ fontSize: 12 }}>
            {flowHook.stepIndex + 1} / {flowHook.totalSteps}
          </AppText>
        </View>

        {/* Progress bar */}
        <View style={{ backgroundColor: theme.colors.border, borderRadius: 99, height: 2 }}>
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: 99,
              height: 2,
              width: `${((flowHook.stepIndex + 1) / flowHook.totalSteps) * 100}%`,
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
              {STEP_TITLES[flowHook.step]}
            </AppText>
            {STEP_HINTS[flowHook.step] ? (
              <AppText tone="muted">{STEP_HINTS[flowHook.step]}</AppText>
            ) : null}
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
