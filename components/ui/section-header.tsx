import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      {subtitle ? <AppText tone="muted">{subtitle}</AppText> : null}
    </View>
  );
}
