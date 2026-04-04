import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { CLOSET_FIT_STATUS_OPTIONS, type ClosetItemFitStatus } from '@/types/closet';

type FitStatusPickerProps = {
  value: ClosetItemFitStatus | undefined;
  onChange: (value: ClosetItemFitStatus | undefined) => void;
};

export function FitStatusPicker({ value, onChange }: FitStatusPickerProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
        How It Fits
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}>
        {CLOSET_FIT_STATUS_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onChange(value === opt.value ? undefined : opt.value)}
            style={{
              backgroundColor: value === opt.value ? theme.colors.accent : theme.colors.surface,
              borderColor: value === opt.value ? theme.colors.accent : theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}>
            <AppText style={{ color: value === opt.value ? '#FFF' : theme.colors.text, fontSize: 13 }}>
              {opt.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
