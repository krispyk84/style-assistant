import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';

type ItineraryDayCardProps = {
  date: string; // YYYY-MM-DD
  summary: string;
  onChangeSummary: (summary: string) => void;
  onRemove: () => void;
};

// Parses YYYY-MM-DD as local midnight to avoid the date shifting a day
// backward/forward under `new Date(string)`'s UTC-parsing behavior — mirrors
// backend/src/ai/prompts/trips.prompts.ts's parseISODate.
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * One editable row for a day extracted from an uploaded itinerary PDF —
 * modeled on AnchorItemCard's mount-guarded local-state-then-onChange-upward
 * pattern. The date itself isn't editable (it's what identifies the day and
 * what generation matches against); only the summary text is.
 */
export function ItineraryDayCard({ date, summary, onChangeSummary, onRemove }: ItineraryDayCardProps) {
  const [text, setText] = useState(summary);

  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    onChangeSummary(text);
  }, [text, onChangeSummary]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
          {formatDateLabel(date)}
        </AppText>
        <Pressable hitSlop={8} onPress={onRemove}>
          <AppIcon color={theme.colors.subtleText} name="close" size={18} />
        </Pressable>
      </View>
      <TextInput
        multiline
        onChangeText={setText}
        placeholderTextColor={theme.colors.subtleText}
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.sans,
          fontSize: 14,
          minHeight: 36,
          textAlignVertical: 'top',
        }}
        value={text}
      />
    </View>
  );
}
