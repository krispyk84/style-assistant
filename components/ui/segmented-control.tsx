import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        padding: spacing.xs,
      }}>
      {options.map((option) => {
        const isActive = option === value;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              backgroundColor: isActive ? theme.colors.text : 'transparent',
              borderRadius: 16,
              minHeight: 40,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
            }}>
            <AppText
              style={{
                color: isActive ? theme.colors.background : theme.colors.text,
                textTransform: 'capitalize',
              }}>
              {option.replaceAll('-', ' ')}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
