import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { STYLISTS, type StylistId } from '@/lib/stylists';

type StylistPickerProps = {
  selectedId: StylistId | null;
  onSelect: (id: StylistId) => void;
};

/**
 * "Choose Your Stylist" — the Ask a Stylist flow's own selection moment.
 * Reuses STYLISTS/avatar imagery from lib/stylists.ts (the same data the
 * Second Opinion feature's chooser uses) but with its own presentation: one
 * descriptive sentence per stylist rather than a keyword chip list, and no
 * modal wrapper since this is a section within the flow's own screen, not a
 * popup. The selected stylist becomes part of the actual generation request
 * (GenerateOutfitsRequest.stylistId) — this component only owns the visual
 * selection state.
 */
export function StylistPicker({ selectedId, onSelect }: StylistPickerProps) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {STYLISTS.map((stylist) => {
        const isSelected = selectedId === stylist.id;
        return (
          <Pressable
            key={stylist.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Choose ${stylist.name}`}
            onPress={() => onSelect(stylist.id)}
            style={{
              alignItems: 'center',
              backgroundColor: isSelected ? theme.colors.card : theme.colors.surface,
              borderColor: isSelected ? theme.colors.accent : theme.colors.border,
              borderRadius: 22,
              borderWidth: isSelected ? 2 : 1,
              flex: 1,
              gap: spacing.sm,
              padding: spacing.md,
            }}>
            <View
              style={{
                borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                borderRadius: 44,
                borderWidth: 2,
                height: 88,
                overflow: 'hidden',
                width: 88,
              }}>
              <Image contentFit="cover" contentPosition="top" source={stylist.image} style={{ height: '100%', width: '100%' }} />
            </View>

            <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
              {stylist.name}
            </AppText>
            <AppText tone="subtle" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }}>
              {stylist.description}
            </AppText>

            {isSelected ? (
              <AppIcon color={theme.colors.accent} name="check-circle" size={18} />
            ) : (
              <AppIcon color={theme.colors.border} name="circle" size={18} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
