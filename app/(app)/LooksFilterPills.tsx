import { Pressable, ScrollView } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

// ── Props ─────────────────────────────────────────────────────────────────────

type LooksFilterPillsProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  /** Pill background when active. 'text' uses theme.text (dark), 'accent' uses theme.accent (orange). */
  activeColor?: 'text' | 'accent';
};

// ── View ──────────────────────────────────────────────────────────────────────

export function LooksFilterPills<T extends string>({
  options,
  selected,
  onSelect,
  activeColor = 'text',
}: LooksFilterPillsProps<T>) {
  const { theme } = useTheme();
  const activeBg = activeColor === 'text' ? theme.colors.text : theme.colors.accent;
  const activeFg = activeColor === 'text' ? theme.colors.inverseText : '#FFFFFF';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.xs }}
      style={{ flexShrink: 0 }}>
      {options.map(({ value, label }) => {
        const isActive = selected === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={{
              backgroundColor: isActive ? activeBg : 'transparent',
              borderColor: isActive ? activeBg : theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}>
            <AppText
              style={{
                color: isActive ? activeFg : theme.colors.mutedText,
                fontFamily: staticTheme.fonts.sansMedium,
                fontSize: 12,
                letterSpacing: 0.3,
              }}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
