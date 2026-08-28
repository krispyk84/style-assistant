import { Image } from 'expo-image';
import { View } from 'react-native';
import Swiper from 'react-native-deck-swiper';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { HaircutOption } from '@/types/api';

type HaircutSwipeDeckProps = {
  options: HaircutOption[];
  onSwipedRight: (cardIndex: number) => void;
  onSwipedAll: () => void;
};

export function HaircutSwipeDeck({ options, onSwipedRight, onSwipedAll }: HaircutSwipeDeckProps) {
  return (
    <View style={{ flex: 1, minHeight: 460 }}>
      <Swiper
        cards={options}
        keyExtractor={(option) => option.id}
        renderCard={(option) => (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 24,
              borderWidth: 1,
              flex: 1,
              overflow: 'hidden',
            }}>
            {option.imageUrl ? (
              <Image contentFit="cover" source={{ uri: option.imageUrl }} style={{ flex: 1 }} />
            ) : null}
            <View style={{ backgroundColor: theme.colors.surface, padding: spacing.md }}>
              <AppText variant="sectionTitle">{option.styleLabel}</AppText>
              <AppText tone="muted" style={{ fontSize: 13 }}>{option.styleSummary}</AppText>
            </View>
          </View>
        )}
        onSwipedRight={onSwipedRight}
        onSwipedAll={onSwipedAll}
        cardIndex={0}
        stackSize={3}
        stackSeparation={14}
        showSecondCard
        verticalSwipe={false}
        disableTopSwipe
        disableBottomSwipe
        backgroundColor="transparent"
        overlayLabels={{
          left: {
            title: 'PASS',
            style: { label: { color: theme.colors.danger, fontSize: 26, fontWeight: '700' }, wrapper: { alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 30, marginLeft: -30 } },
          },
          right: {
            title: 'LIKE',
            style: { label: { color: theme.colors.accent, fontSize: 26, fontWeight: '700' }, wrapper: { alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 30, marginLeft: 30 } },
          },
        }}
      />
    </View>
  );
}
