import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { HaircutAngleShots, HaircutGuideResponse, HaircutOption } from '@/types/api';

type HaircutGuideViewProps = {
  option: HaircutOption;
  guide: HaircutGuideResponse;
  angleShots: HaircutAngleShots | null;
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

// Square tiles — the source headshot (and every edit derived from it) is
// captured/uploaded square, so matching that aspect ratio avoids the crop
// biasing toward one side that a mismatched fixed height would cause.
function AnglePhoto({ label, option }: { label: string; option: HaircutOption | null }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ aspectRatio: 1, backgroundColor: theme.colors.card, borderRadius: 14, overflow: 'hidden', width: '100%' }}>
        {option?.status === 'ready' && option.imageUrl ? (
          <Image contentFit="cover" source={{ uri: option.imageUrl }} style={{ height: '100%', width: '100%' }} />
        ) : option?.status === 'failed' ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <AppIcon color={theme.colors.subtleText} name="warning" size={18} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
          </View>
        )}
      </View>
      <AppText tone="subtle" style={{ fontSize: 10, textAlign: 'center' }}>{label}</AppText>
    </View>
  );
}

export function HaircutGuideView({ option, guide, angleShots }: HaircutGuideViewProps) {
  return (
    <View style={{ backgroundColor: theme.colors.background, gap: spacing.lg, padding: spacing.lg, width: 360 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText tone="muted" variant="eyebrow" style={{ letterSpacing: 2.4 }}>HAIRCUT GUIDE</AppText>
        <AppText variant="heroSmall" style={{ textAlign: 'center' }}>{option.styleLabel}</AppText>
      </View>

      {option.imageUrl ? (
        <View style={{ aspectRatio: 1, borderRadius: 20, overflow: 'hidden', width: '100%' }}>
          <Image contentFit="cover" source={{ uri: option.imageUrl }} style={{ height: '100%', width: '100%' }} />
        </View>
      ) : null}

      {angleShots ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <AnglePhoto label="Front Angled" option={angleShots.frontAngled} />
          <AnglePhoto label="Side" option={angleShots.side} />
          <AnglePhoto label="Back" option={angleShots.back} />
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
