import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { HaircutGuideResponse, HaircutOption } from '@/types/api';

type HaircutGuideViewProps = {
  option: HaircutOption;
  guide: HaircutGuideResponse;
};

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.6 }}>{title}</AppText>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <AppText key={item} style={{ fontSize: 13, lineHeight: 19 }}>{'•  '}{item}</AppText>
      ))}
    </View>
  );
}

export function HaircutGuideView({ option, guide }: HaircutGuideViewProps) {
  return (
    <View style={{ backgroundColor: theme.colors.background, gap: spacing.lg, padding: spacing.lg, width: 360 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText tone="muted" variant="eyebrow" style={{ letterSpacing: 2.4 }}>HAIRCUT GUIDE</AppText>
        <AppText variant="heroSmall" style={{ textAlign: 'center' }}>{option.styleLabel}</AppText>
      </View>

      {option.imageUrl ? (
        <View style={{ borderRadius: 20, height: 340, overflow: 'hidden' }}>
          <Image contentFit="cover" source={{ uri: option.imageUrl }} style={{ height: '100%', width: '100%' }} />
        </View>
      ) : null}

      <Section title="THE LOOK">
        <AppText style={{ fontSize: 14, lineHeight: 20 }}>{guide.theLook}</AppText>
      </Section>

      <Section title="WHAT TO ASK FOR">
        <BulletList items={guide.whatToAskFor} />
      </Section>

      <Section title="CUT DETAILS">
        <BulletList items={guide.cutDetails} />
      </Section>

      <Section title="STYLING TIPS">
        <BulletList items={guide.stylingTips} />
      </Section>

      <Section title="WHAT TO AVOID">
        <BulletList items={guide.whatToAvoid} />
      </Section>

      <Section title="MAINTENANCE">
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{guide.maintenance}</AppText>
      </Section>

      <Section title="PRODUCTS">
        <BulletList items={guide.products} />
      </Section>
    </View>
  );
}
