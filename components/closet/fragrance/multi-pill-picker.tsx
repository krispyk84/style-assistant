import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/contexts/theme-context';
import { spacing } from '@/constants/theme';

type MultiPillPickerProps<T extends string> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
};

export function MultiPillPicker<T extends string>({ label, options, value, onChange }: MultiPillPickerProps<T>) {
  const { theme } = useTheme();

  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}>
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              }}>
              <AppText style={{ fontSize: 13, color: active ? theme.colors.inverseText : theme.colors.text }}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
