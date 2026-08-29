import { Image } from 'expo-image';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { SeasonalTrendReportEntry } from '@/types/api';

type FashionTrendReportModalProps = {
  visible: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  trends: SeasonalTrendReportEntry[] | null;
  isStale: boolean;
  error: string | null;
  onClose: () => void;
};

const LIFECYCLE_LABEL: Record<SeasonalTrendReportEntry['lifecycle'], string> = {
  emerging: 'Emerging',
  current: 'Current',
  established: 'Established',
  declining: 'Declining',
};

export function FashionTrendReportModal({ visible, isLoading, isGenerating, trends, isStale, error, onClose }: FashionTrendReportModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: spacing.sm,
            justifyContent: 'space-between',
            // Modal content renders outside the normal safe-area tree on iOS, so
            // insets.top can read as 0 here even though content draws under the
            // status bar — fall back to a fixed clearance if insets look unset.
            paddingTop: Math.max(insets.top, 50),
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="sectionTitle">Fashion Trend Report</AppText>
            <AppText tone="muted" style={{ fontSize: 13 }}>
              This season&apos;s top 20 — spanning business, smart casual, and casual.
            </AppText>
          </View>
          <Pressable hitSlop={12} onPress={onClose}>
            <AppIcon color={theme.colors.subtleText} name="close" size={24} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
            <ActivityIndicator color={theme.colors.accent} />
            {isGenerating ? (
              <AppText tone="muted" style={{ textAlign: 'center', fontSize: 13 }}>
                Putting this season&apos;s report together — this can take a few seconds.
              </AppText>
            ) : null}
          </View>
        ) : error || !trends ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
            <AppText tone="muted" style={{ textAlign: 'center' }}>{error ?? 'No trend report available yet.'}</AppText>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
            {isStale ? (
              <AppText tone="subtle" style={{ fontSize: 12, fontStyle: 'italic' }}>
                Showing last season&apos;s report while this season&apos;s is being refreshed.
              </AppText>
            ) : null}
            {trends.map((trend, index) => {
              const showSectionHeader = index === 0 || trends[index - 1]!.formality !== trend.formality;
              return (
                <View key={`${trend.name}-${index}`} style={{ gap: spacing.md }}>
                  {showSectionHeader ? (
                    <AppText
                      variant="eyebrow"
                      style={{
                        color: theme.colors.mutedText,
                        letterSpacing: 1.8,
                        marginTop: index > 0 ? spacing.xs : 0,
                      }}>
                      {formatTierLabel(trend.formality)}
                    </AppText>
                  ) : null}
                  <TrendRow trend={trend} showDivider={!showSectionHeader} />
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function TrendRow({ trend, showDivider }: { trend: SeasonalTrendReportEntry; showDivider: boolean }) {
  const isDirectional = trend.lifecycle === 'emerging' || trend.lifecycle === 'current';

  return (
    <View
      style={{
        borderTopColor: theme.colors.border,
        borderTopWidth: showDivider ? 1 : 0,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: showDivider ? spacing.md : 0,
      }}>
      <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, height: 88, overflow: 'hidden', width: 66 }}>
        {trend.sketchStatus === 'ready' && trend.sketchImageUrl ? (
          <Image contentFit="cover" source={{ uri: trend.sketchImageUrl }} style={{ height: '100%', width: '100%' }} />
        ) : trend.sketchStatus === 'pending' || trend.sketchStatus === null ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.subtleText} size="small" />
          </View>
        ) : (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <AppIcon color={theme.colors.subtleText} name="sparkles" size={18} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1, fontFamily: theme.fonts.sansMedium, fontSize: 15 }}>{trend.name}</AppText>
          <View
            style={{
              backgroundColor: isDirectional ? theme.colors.accent : theme.colors.subtleSurface,
              borderRadius: 999,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}>
            <AppText
              variant="eyebrow"
              style={{
                color: isDirectional ? theme.colors.inverseText : theme.colors.mutedText,
                fontSize: 10,
                letterSpacing: 1,
              }}>
              {LIFECYCLE_LABEL[trend.lifecycle]}
            </AppText>
          </View>
        </View>
        <AppText tone="muted" style={{ fontSize: 13 }}>{trend.summary}</AppText>
      </View>
    </View>
  );
}
