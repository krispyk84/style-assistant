import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetReadinessProgress } from '@/lib/closet-readiness';

/** Per-category "have / need" progress toward unlocking closet-driven outfit generation. */
export function ClosetReadinessTracker({
  progress,
}: {
  progress: { total: ClosetReadinessProgress; tops: ClosetReadinessProgress; bottoms: ClosetReadinessProgress; footwear: ClosetReadinessProgress };
}) {
  const rows: { label: string; value: ClosetReadinessProgress }[] = [
    { label: 'Tops', value: progress.tops },
    { label: 'Bottoms', value: progress.bottoms },
    { label: 'Footwear', value: progress.footwear },
  ];

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => (
        <ClosetReadinessRow key={row.label} label={row.label} value={row.value} />
      ))}
      <ClosetReadinessRow label="Total items" value={progress.total} />
    </View>
  );
}

function ClosetReadinessRow({ label, value }: { label: string; value: ClosetReadinessProgress }) {
  const { theme } = useTheme();
  const met = value.have >= value.need;
  const ratio = Math.min(1, value.need > 0 ? value.have / value.need : 1);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText tone="subtle" style={{ fontSize: 12 }}>{label}</AppText>
        <AppText tone={met ? undefined : 'subtle'} style={{ color: met ? theme.colors.accent : undefined, fontSize: 12, fontFamily: theme.fonts.sansMedium }}>
          {value.have}/{value.need}
        </AppText>
      </View>
      <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 5, overflow: 'hidden' }}>
        <View style={{ backgroundColor: met ? theme.colors.accent : theme.colors.subtleText, borderRadius: 999, height: '100%', width: `${ratio * 100}%` }} />
      </View>
    </View>
  );
}

export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
