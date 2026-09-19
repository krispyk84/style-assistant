import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/contexts/theme-context';
import { spacing } from '@/constants/theme';

type AccordTagInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

/** Free-text accord entry ("Citrus", "Leather", ...) — equal weighting on save, no fine-grained weight UI (see lib/fragrance-form-mappers.ts's accordNamesToAccords). */
export function AccordTagInput({ value, onChange }: AccordTagInputProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Main Accords</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commitDraft}
          placeholder="e.g. Citrus, Amber, Leather"
          placeholderTextColor={theme.colors.subtleText}
          returnKeyType="done"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.fonts.sans,
            fontSize: 15,
            minHeight: 48,
            paddingHorizontal: spacing.md,
          }}
        />
        <Pressable
          onPress={commitDraft}
          disabled={!draft.trim()}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.subtleSurface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            justifyContent: 'center',
            opacity: draft.trim() ? 1 : 0.5,
            width: 48,
          }}>
          <AppIcon color={theme.colors.accent} name="add" size={18} />
        </Pressable>
      </View>
      {value.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {value.map((accord, index) => (
            <Pressable
              key={`${accord}-${index}`}
              onPress={() => removeAt(index)}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                flexDirection: 'row',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              }}>
              <AppText style={{ fontSize: 13, color: theme.colors.inverseText }}>{accord}</AppText>
              <AppIcon color={theme.colors.inverseText} name="close" size={12} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
