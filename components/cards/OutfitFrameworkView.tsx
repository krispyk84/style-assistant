import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { OutfitFrameworkDisplay } from '@/types/api';

/**
 * Renders the enforced outfit framework's slot-by-slot breakdown — the exact
 * structure the outfit was built to (Casual / Smart Casual / Business, with
 * a "Suit" row replacing separate Bottoms + Secondary Top when applicable).
 * Every slot in the framework is always shown, in order; an unused optional
 * slot renders "x" rather than being omitted, so it's visible at a glance
 * which optional layers this specific outfit did and didn't call for.
 */
export function OutfitFrameworkView({ framework }: { framework: OutfitFrameworkDisplay }) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText
        style={{
          color: theme.colors.mutedText,
          fontFamily: theme.fonts.sansMedium,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}>
        {framework.frameworkLabel} Framework
      </AppText>
      <View style={{ gap: spacing.xs }}>
        {framework.slots.map((slot) => {
          const hasItems = slot.items.length > 0;
          return (
            <View
              key={slot.label}
              style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }}>
              <AppText style={{ flex: 4 }} variant="sectionTitle">
                {slot.label}
              </AppText>
              <AppText style={{ flex: 6, textAlign: 'right' }} tone={hasItems ? 'default' : 'muted'}>
                {hasItems ? slot.items.map((item) => item.title).join(', ') : 'x'}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
