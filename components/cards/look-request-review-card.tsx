import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';

type LookRequestReviewCardProps = {
  input: CreateLookInput;
  hideInfoBox?: boolean;
  recommendations?: LookRecommendation[];
};

export function LookRequestReviewCard({ input, hideInfoBox = false, recommendations }: LookRequestReviewCardProps) {
  const aiAnchorDescription = recommendations?.[0]?.anchorItem ?? null;
  const vibeChips = input.vibeKeywords
    ? input.vibeKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [];

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      {/* ── Wardrobe Anchors ── */}
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <Ionicons color={theme.colors.accent} name="shirt-outline" size={16} />
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Wardrobe Anchors
            </AppText>
          </View>
          <AppText variant="eyebrow" tone="subtle">
            {input.anchorItems.length} {input.anchorItems.length === 1 ? 'Item' : 'Items'}
          </AppText>
        </View>

        {input.anchorItems.map((item) => {
          const previewUri = item.image?.uri ?? item.uploadedImage?.publicUrl ?? null;
          const description = item.description.trim() || aiAnchorDescription || null;

          return (
            <View
              key={item.id}
              style={{
                alignItems: 'center',
                borderTopColor: theme.colors.border,
                borderTopWidth: 1,
                flexDirection: 'row',
                gap: spacing.md,
                paddingTop: spacing.md,
              }}>
              {/* Circular thumbnail */}
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.colors.card,
                  borderRadius: 999,
                  flexShrink: 0,
                  height: 56,
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: 56,
                }}>
                {previewUri ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: previewUri }}
                    style={{ height: 56, width: 56 }}
                  />
                ) : (
                  <Ionicons color={theme.colors.subtleText} name="image-outline" size={22} />
                )}
              </View>

              {/* Description */}
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="sectionTitle" numberOfLines={1}>
                  {description ?? 'Anchor item'}
                </AppText>
                {description ? (
                  <AppText
                    tone="muted"
                    numberOfLines={2}
                    style={{ fontStyle: 'italic', fontSize: 13, lineHeight: 18 }}>
                    "{description}"
                  </AppText>
                ) : null}
              </View>

              <Ionicons color={theme.colors.accent} name="checkmark-circle-outline" size={22} />
            </View>
          );
        })}
      </View>

      {/* Divider */}
      <View style={{ backgroundColor: theme.colors.border, height: 1, marginHorizontal: spacing.lg }} />

      {/* ── Styling DNA ── */}
      <View style={{ gap: spacing.lg, padding: spacing.lg }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Ionicons color={theme.colors.accent} name="sparkles-outline" size={16} />
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Styling DNA
          </AppText>
        </View>

        {/* Aesthetic Vibe */}
        {vibeChips.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
              <Ionicons color={theme.colors.subtleText} name="pricetag-outline" size={13} />
              <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.6 }}>
                Aesthetic Vibe
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {vibeChips.map((chip) => (
                <View
                  key={chip}
                  style={{
                    backgroundColor: theme.colors.subtleSurface,
                    borderColor: theme.colors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  }}>
                  <AppText style={{ fontSize: 13 }}>{chip}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Target Tier */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
            <Ionicons color={theme.colors.subtleText} name="layers-outline" size={13} />
            <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.6 }}>
              Target Tier
            </AppText>
          </View>
          {input.selectedTiers.map((tier) => (
            <View
              key={tier}
              style={{
                alignItems: 'center',
                borderBottomColor: theme.colors.border,
                borderBottomWidth: 1,
                flexDirection: 'row',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
              }}>
              <View
                style={{
                  backgroundColor: theme.colors.accent,
                  borderRadius: 999,
                  height: 8,
                  width: 8,
                }}
              />
              <AppText variant="sectionTitle" style={{ flex: 1 }}>{formatTierLabel(tier)}</AppText>
            </View>
          ))}
        </View>

        {/* Info box — shown on review/confirm page, hidden on results page */}
        {!hideInfoBox ? (
          <View
            style={{
              backgroundColor: theme.colors.subtleSurface,
              borderRadius: 16,
              flexDirection: 'row',
              gap: spacing.sm,
              padding: spacing.md,
            }}>
            <Ionicons
              color={theme.colors.mutedText}
              name="information-circle-outline"
              size={18}
              style={{ marginTop: 1 }}
            />
            <AppText tone="muted" style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>
              Our digital stylist will now analyze these pieces and preferences to curate three distinct outfit options for your selected tier.
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
