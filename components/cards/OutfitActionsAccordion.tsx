import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type OutfitActionsAccordionProps = {
  children: ReactNode;
};

/**
 * Collapsed-by-default "Actions" section shared by every outfit card — Love/Hate
 * stay outside it, always visible, everything else (Save, Add to week, Selfie
 * Check, Second Opinion, Ask Questions, Redo sketch) lives inside.
 */
export function OutfitActionsAccordion({ children }: OutfitActionsAccordionProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={isExpanded ? 'Collapse actions' : 'Expand actions'}
        onPress={() => setIsExpanded((v) => !v)}
        style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Actions</AppText>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            height: 28,
            justifyContent: 'center',
            width: 28,
          }}>
          <AppIcon color={theme.colors.text} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </View>
      </Pressable>
      {isExpanded ? <View style={{ gap: spacing.sm }}>{children}</View> : null}
    </View>
  );
}
