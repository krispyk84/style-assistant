import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  variant?: 'default' | 'hero' | 'page';
};

export function SectionHeader({ title, subtitle, eyebrow, variant = 'default' }: SectionHeaderProps) {
  const titleVariant = variant === 'hero' ? 'hero' : variant === 'page' ? 'heroSmall' : 'sectionTitle';
  
  return (
    <View style={{ gap: variant === 'default' ? spacing.xs : spacing.sm }}>
      {eyebrow && (
        <AppText variant="eyebrow" tone="accent">{eyebrow}</AppText>
      )}
      <AppText variant={titleVariant}>{title}</AppText>
      {subtitle && (
        <AppText 
          variant={variant === 'default' ? 'caption' : 'body'} 
          tone="muted"
          style={variant !== 'default' ? { maxWidth: 320 } : undefined}
        >
          {subtitle}
        </AppText>
      )}
    </View>
  );
}
