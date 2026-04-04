import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { CLOSET_FIT_STATUS_OPTIONS, type ClosetItemFitStatus } from '@/types/closet';

type FitStatusPickerProps = {
  value: ClosetItemFitStatus | undefined;
  onChange: (value: ClosetItemFitStatus | undefined) => void;
};

export function FitStatusPicker({ value, onChange }: FitStatusPickerProps) {
  return (
    <View style={styles.container}>
      <AppText variant="eyebrow" style={styles.label}>
        How It Fits
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {CLOSET_FIT_STATUS_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(active ? undefined : opt.value)}
              style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
              <AppText style={[styles.pillText, { color: active ? theme.colors.inverseText : theme.colors.text }]}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { color: theme.colors.mutedText, letterSpacing: 1.6 },
  scrollContent: { gap: spacing.xs, paddingVertical: 2 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillInactive: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  pillText: { fontSize: 13 },
});
