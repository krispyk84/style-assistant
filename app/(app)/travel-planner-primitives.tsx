import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

// ── Card wrapper ──────────────────────────────────────────────────────────────

export function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        gap: spacing.lg,
        padding: spacing.lg,
      }}>
      {children}
    </View>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────

export function FieldLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <AppText
      variant="eyebrow"
      style={{ color: theme.colors.mutedText, letterSpacing: 1.6, marginBottom: spacing.xs }}>
      {children}
    </AppText>
  );
}

// ── Multi-select chip grid ────────────────────────────────────────────────────
// Genericized from a trip-purpose-specific component: values are plain
// strings, so it doubles as the "What will you be doing?" activity picker
// (with an optional "+ Add something else" custom-entry affordance) as well
// as any other chip-based multi-select.

type ChipGridProps = {
  options: readonly string[];
  values: string[];
  onChange: (v: string) => void;
  /** When provided, renders a trailing "+ Add something else" chip that reveals an inline text entry. */
  onAddCustom?: (value: string) => void;
};

export function ChipGrid({ options, values, onChange, onAddCustom }: ChipGridProps) {
  const { theme } = useTheme();
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  function submitCustom() {
    const trimmed = customText.trim();
    if (trimmed) onAddCustom?.(trimmed);
    setCustomText('');
    setIsAddingCustom(false);
  }

  // Values the caller added via onAddCustom (or that arrived from elsewhere,
  // e.g. a legacy stored purpose) don't appear in `options` — render them too,
  // always active, so they're visible and can be tapped off again.
  const customValues = values.filter((v) => !options.includes(v));

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {[...options, ...customValues].map((opt) => {
        const active = values.includes(opt);
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              backgroundColor: active ? theme.colors.text : theme.colors.subtleSurface,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
            }}>
            <AppText
              style={{
                color: active ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: active ? theme.fonts.sansMedium : theme.fonts.sans,
                fontSize: 13,
              }}>
              {opt}
            </AppText>
          </Pressable>
        );
      })}
      {onAddCustom ? (
        isAddingCustom ? (
          <TextInput
            autoFocus
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={submitCustom}
            onBlur={submitCustom}
            placeholder="Add something else…"
            placeholderTextColor={theme.colors.subtleText}
            returnKeyType="done"
            style={{
              backgroundColor: theme.colors.subtleSurface,
              borderRadius: 999,
              color: theme.colors.text,
              fontFamily: theme.fonts.sans,
              fontSize: 13,
              minWidth: 160,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
            }}
          />
        ) : (
          <Pressable
            onPress={() => setIsAddingCustom(true)}
            style={{
              backgroundColor: 'transparent',
              borderColor: theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm - 2,
            }}>
            <AppText style={{ color: theme.colors.subtleText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              + Add something else
            </AppText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
