import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { Profile, ProfileValidationErrors } from '@/types/profile';
import {
  GENDER_OPTIONS,
  SUMMER_BOTTOM_OPTIONS,
  TEMPERATURE_UNIT_OPTIONS,
} from '@/types/profile';
import type { HeightUnit, WeightUnit } from './profile-form-mappers';
import type { PickerConfig, PickerFieldKey } from './useProfileForm';

// ── Props ─────────────────────────────────────────────────────────────────────

export type ProfileFormViewProps = {
  // Form state
  profile: Profile;
  heightUnit: HeightUnit;
  heightFeet: string;
  heightInches: string;
  weightUnit: WeightUnit;
  weightValue: string;
  errors: ProfileValidationErrors;
  pickerField: PickerFieldKey | null;
  pickerConfigs: Record<PickerFieldKey, PickerConfig>;

  // Field setters
  setHeightFeet: (v: string) => void;
  setHeightInches: (v: string) => void;
  setWeightValue: (v: string) => void;
  setPickerField: (field: PickerFieldKey | null) => void;

  // Handlers
  updateField: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  handleHeightUnitChange: (unit: string) => void;
  handleWeightUnitChange: (unit: string) => void;
  handleSubmit: () => void;

  // Parent props
  submitLabel: string;
  disabled: boolean;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function ProfileFormView({
  profile,
  heightUnit,
  heightFeet,
  heightInches,
  weightUnit,
  weightValue,
  errors,
  pickerField,
  pickerConfigs,
  setHeightFeet,
  setHeightInches,
  setWeightValue,
  setPickerField,
  updateField,
  handleHeightUnitChange,
  handleWeightUnitChange,
  handleSubmit,
  submitLabel,
  disabled,
}: ProfileFormViewProps) {
  const { theme } = useTheme();

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

  return (
    <View style={{ gap: spacing.xl }}>
      <FormField label="First name" hint="Used to personalise your home screen greeting.">
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Your name"
          placeholderTextColor={theme.colors.subtleText}
          style={inputStyle}
          value={profile.name}
        />
      </FormField>

      <FormField label="Gender" hint="Used to tailor fit and style guidance.">
        <SegmentedControl
          options={GENDER_OPTIONS}
          value={profile.gender}
          onChange={(value) => updateField('gender', value)}
        />
      </FormField>

      <FormField label="Height" hint="Switch between centimetres and feet anytime." error={errors.heightCm as string | undefined}>
        <View style={{ gap: spacing.md }}>
          <SegmentedControl options={['cm', 'ft']} value={heightUnit} onChange={handleHeightUnitChange} />
          {heightUnit === 'cm' ? (
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => updateField('heightCm', value.replace(/[^0-9]/g, ''))}
              placeholder="183"
              placeholderTextColor={theme.colors.subtleText}
              style={inputStyle}
              value={profile.heightCm}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(v) => setHeightFeet(v.replace(/[^0-9]/g, ''))}
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
                  onChangeText={(v) => setHeightInches(v.replace(/[^0-9.]/g, ''))}
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
      </FormField>

      <FormField label="Weight" hint="Switch between kilograms and pounds anytime." error={errors.weightKg as string | undefined}>
        <View style={{ gap: spacing.md }}>
          <SegmentedControl options={['kg', 'lbs']} value={weightUnit} onChange={handleWeightUnitChange} />
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setWeightValue(value.replace(/[^0-9]/g, ''))}
            placeholder={weightUnit === 'kg' ? '79' : '174'}
            placeholderTextColor={theme.colors.subtleText}
            style={inputStyle}
            value={weightValue}
          />
        </View>
      </FormField>

      {profile.gender === 'man' ? (
        <FormField label="Body type" hint="Used to personalise outfit sketches.">
          <PickerField value={profile.bodyType ?? ''} onPress={() => setPickerField('bodyType')} />
        </FormField>
      ) : null}

      {profile.gender === 'man' ? (
        <FormField label="How clothes typically fit" hint="Helps us recommend the right cuts and note alterations.">
          <PickerField value={profile.fitTendency ?? ''} onPress={() => setPickerField('fitTendency')} />
        </FormField>
      ) : null}

      <FormField label="Fit preference" hint="How you want clothes to sit on the body.">
        <PickerField value={profile.fitPreference} onPress={() => setPickerField('fitPreference')} />
      </FormField>

      <FormField label="Style preference" hint="Pick the closest overall direction.">
        <PickerField value={profile.stylePreference} onPress={() => setPickerField('stylePreference')} />
      </FormField>

      <FormField label="Budget" hint="Helps future recommendations stay realistic.">
        <PickerField value={profile.budget} onPress={() => setPickerField('budget')} />
      </FormField>

      <FormField label="Hair color" hint="Useful for palette and contrast cues.">
        <PickerField value={profile.hairColor} onPress={() => setPickerField('hairColor')} />
      </FormField>

      <FormField label="Skin tone" hint="Used later for color guidance.">
        <PickerField value={profile.skinTone} onPress={() => setPickerField('skinTone')} />
      </FormField>

      <FormField label="Warm weather bottoms" hint="Choose whether summer looks can include shorts or should stay with longer bottoms.">
        <SegmentedControl
          options={SUMMER_BOTTOM_OPTIONS}
          value={profile.summerBottomPreference}
          onChange={(value) => updateField('summerBottomPreference', value)}
        />
      </FormField>

      <FormField label="Temperature unit" hint="Use your preferred unit wherever temperatures appear in the app.">
        <SegmentedControl
          options={TEMPERATURE_UNIT_OPTIONS}
          value={profile.temperatureUnit}
          onChange={(value) => updateField('temperatureUnit', value)}
        />
      </FormField>

      <FormField label="Notes" hint="Optional context like profession, climate, or wardrobe pain points." error={errors.notes as string | undefined}>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={(value) => updateField('notes', value)}
          placeholder="Optional notes"
          placeholderTextColor={theme.colors.subtleText}
          style={[inputStyle, { minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }]}
          value={profile.notes}
        />
      </FormField>

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton disabled={disabled} label={disabled ? 'Saving...' : submitLabel} onPress={handleSubmit} />
        <AppText tone="muted">Your profile is saved to the Vesture backend and used for personalized guidance.</AppText>
      </View>

      <PickerModal
        visible={Boolean(pickerField)}
        title={pickerField ? pickerConfigs[pickerField].label : ''}
        options={pickerField ? pickerConfigs[pickerField].options : []}
        value={pickerField ? pickerConfigs[pickerField].value : ''}
        onClose={() => setPickerField(null)}
        onSelect={(value) => {
          if (!pickerField) return;
          pickerConfigs[pickerField].onChange(value);
          setPickerField(null);
        }}
      />
    </View>
  );
}

// ── Private UI components ─────────────────────────────────────────────────────

function PickerField({ value, onPress }: { value: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 18,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 54,
        paddingHorizontal: spacing.md,
      }}>
      <AppText style={{ textTransform: 'capitalize' }}>{value.replaceAll('-', ' ')}</AppText>
      <Ionicons color={theme.colors.subtleText} name="chevron-down" size={18} />
    </Pressable>
  );
}

function PickerModal({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const { theme } = useTheme();
  const optionStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  } as const;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.overlay,
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            gap: spacing.lg,
            maxWidth: 420,
            padding: spacing.lg,
            width: '100%',
          }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title">{title}</AppText>
            <AppText tone="muted">Choose the option that fits you best.</AppText>
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.sm }}>
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <Pressable
                  key={option}
                  onPress={() => onSelect(option)}
                  style={[
                    optionStyle,
                    { borderColor: isSelected ? theme.colors.accent : theme.colors.border },
                  ]}>
                  <AppText style={{ textTransform: 'capitalize' }}>{option.replaceAll('-', ' ')}</AppText>
                  {isSelected ? <Ionicons color={theme.colors.accent} name="checkmark-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} style={optionStyle}>
            <AppText>Cancel</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
