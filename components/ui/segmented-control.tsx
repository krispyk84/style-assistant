import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label && <AppText variant="eyebrow" tone="subtle">{label}</AppText>}
      <View
        style={[
          {
            backgroundColor: theme.colors.borderSubtle,
            borderRadius: theme.radius.lg,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            padding: spacing.xs,
          },
        ]}>
        {options.map((option) => {
          const isActive = option === value;

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                {
                  backgroundColor: isActive ? theme.colors.surface : 'transparent',
                  borderRadius: theme.radius.md,
                  minHeight: 44,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  opacity: pressed && !isActive ? 0.7 : 1,
                },
                isActive && theme.shadows.sm,
              ]}>
              <AppText
                variant="sectionTitle"
                tone={isActive ? 'default' : 'muted'}
                style={{ textTransform: 'capitalize', fontSize: 14 }}>
                {option.replaceAll('-', ' ')}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
