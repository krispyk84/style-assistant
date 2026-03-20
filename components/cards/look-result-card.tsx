import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { spacing, theme } from '@/constants/theme';
import type { LookRecommendation } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type LookResultCardProps = {
  recommendation: LookRecommendation;
  onRegenerate: () => void;
  detailHref: Href;
  isRegenerating?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onAddToWeek?: () => void;
};

export function LookResultCard({
  recommendation,
  onRegenerate,
  detailHref,
  isRegenerating = false,
  isSaved = false,
  isSaving = false,
  onSave,
  onAddToWeek,
}: LookResultCardProps) {
  const labeledPieces = buildLabeledPieces(recommendation);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        gap: spacing.lg,
        padding: spacing.lg,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">{formatTierLabel(recommendation.tier)}</AppText>
        <AppText tone="muted">{recommendation.title}</AppText>
      </View>

      <TierSketch recommendation={recommendation} />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          disabled={isSaved || isSaving || !onSave}
          onPress={onSave}
          style={[
            actionButtonStyle,
            {
              backgroundColor: isSaved ? theme.colors.border : theme.colors.card,
            },
          ]}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            <Ionicons
              color={theme.colors.text}
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
            />
            <AppText>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}</AppText>
          </View>
        </Pressable>
        <Pressable disabled={!onAddToWeek} onPress={onAddToWeek} style={actionButtonStyle}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            <Ionicons color={theme.colors.text} name="calendar-outline" size={18} />
            <AppText>Add to week</AppText>
          </View>
        </Pressable>
      </View>

      <View style={{ gap: spacing.sm }}>
        {labeledPieces.map((piece) => (
          <View
            key={`${piece.label}-${piece.value}`}
            style={{
              borderBottomColor: theme.colors.border,
              borderBottomWidth: 1,
              gap: spacing.xs,
              paddingBottom: spacing.sm,
            }}>
            <AppText variant="sectionTitle">{piece.label}</AppText>
            <AppText tone="muted">{piece.value}</AppText>
          </View>
        ))}
      </View>

      <CardSection title="Fit notes" items={recommendation.fitNotes} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">Why it works</AppText>
        <AppText tone="muted">{recommendation.whyItWorks}</AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable disabled={isRegenerating} onPress={onRegenerate} style={[actionButtonStyle, { backgroundColor: theme.colors.text, opacity: isRegenerating ? 0.7 : 1 }]}>
          <AppText style={{ color: theme.colors.background }}>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</AppText>
        </Pressable>
        <Link href={detailHref} asChild>
          <Pressable style={actionButtonStyle}>
            <AppText>Select tier</AppText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function TierSketch({ recommendation }: { recommendation: LookRecommendation }) {
  if (recommendation.sketchStatus === 'ready' && recommendation.sketchImageUrl) {
    return (
      <RemoteImagePanel
        uri={recommendation.sketchImageUrl}
        aspectRatio={3 / 4}
        minHeight={280}
        fallbackTitle="Sketch unavailable"
        fallbackMessage="The illustration could not be displayed on this device."
      />
    );
  }

  if (recommendation.sketchStatus === 'pending' || !recommendation.sketchStatus) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 22,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 280,
          padding: spacing.lg,
        }}>
        <AnimatedLoadingBar />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
            Rendering sketch...
          </AppText>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            This illustration will appear automatically when it is ready.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 22,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 180,
        padding: spacing.lg,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
          Sketch unavailable
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          The outfit details are still usable even when the illustration is unavailable.
        </AppText>
      </View>
    </View>
  );
}

function AnimatedLoadingBar() {
  const translateX = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 220,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -140,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.border,
        borderRadius: 999,
        height: 10,
        marginBottom: spacing.md,
        overflow: 'hidden',
        width: '100%',
      }}>
      <Animated.View
        style={{
          backgroundColor: theme.colors.accent,
          borderRadius: 999,
          height: '100%',
          transform: [{ translateX }],
          width: 140,
        }}
      />
    </View>
  );
}

function formatTierLabel(tier: LookRecommendation['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function buildLabeledPieces(recommendation: LookRecommendation) {
  const usedLabels = new Set<string>();
  const pieces = recommendation.keyPieces.map((piece, index) => ({
    label: uniqueLabel(labelForKeyPiece(piece, index), usedLabels),
    value: piece,
  }));

  recommendation.shoes.forEach((shoe, index) => {
    pieces.push({
      label: uniqueLabel(index === 0 ? 'Shoes' : `Shoe ${index + 1}`, usedLabels),
      value: shoe,
    });
  });

  recommendation.accessories.forEach((accessory, index) => {
    pieces.push({
      label: uniqueLabel(`Accessory ${index + 1}`, usedLabels),
      value: accessory,
    });
  });

  return pieces;
}

function uniqueLabel(baseLabel: string, usedLabels: Set<string>) {
  if (!usedLabels.has(baseLabel)) {
    usedLabels.add(baseLabel);
    return baseLabel;
  }

  let counter = 2;
  let nextLabel = `${baseLabel} ${counter}`;
  while (usedLabels.has(nextLabel)) {
    counter += 1;
    nextLabel = `${baseLabel} ${counter}`;
  }

  usedLabels.add(nextLabel);
  return nextLabel;
}

function labelForKeyPiece(piece: string, index: number) {
  const normalized = piece.toLowerCase();

  if (/(suit|blazer|jacket|coat|topcoat|overshirt|chore)/.test(normalized)) {
    return 'Outerwear';
  }

  if (/(shirt|tee|t-shirt|polo|crewneck|sweater|knit|cardigan|hoodie)/.test(normalized)) {
    return 'Top';
  }

  if (/(trouser|pant|pants|jean|denim)/.test(normalized)) {
    return 'Pants';
  }

  if (/(shorts)/.test(normalized)) {
    return 'Shorts';
  }

  return index === 0 ? 'Piece 1' : `Piece ${index + 1}`;
}

function CardSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      {items.map((item) => (
        <AppText key={item} tone="muted">
          • {item}
        </AppText>
      ))}
    </View>
  );
}

const actionButtonStyle = {
  alignItems: 'center',
  backgroundColor: theme.colors.card,
  borderColor: theme.colors.border,
  borderRadius: 999,
  borderWidth: 1,
  flex: 1,
  justifyContent: 'center',
  minHeight: 48,
  paddingHorizontal: spacing.md,
} as const;
