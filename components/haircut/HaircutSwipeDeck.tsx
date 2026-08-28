import { Image } from 'expo-image';
import { Dimensions, View } from 'react-native';
import Swiper from 'react-native-deck-swiper';

import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import type { HaircutOption } from '@/types/api';

type HaircutSwipeDeckProps = {
  options: HaircutOption[];
  onSwipedRight: (cardIndex: number) => void;
  onSwipedLeft: (cardIndex: number) => void;
  onSwipedAll: () => void;
};

// react-native-deck-swiper positions cards by measuring its own container, but
// doesn't reliably propagate a bounded height down through nested flex parents —
// giving the card an explicit pixel height (rather than flex: 1) avoids the
// image rendering at its natural (much larger) intrinsic size.
//
// Its getCardStyle() always computes card width from Dimensions.get('window')
// (the true device width), regardless of how the Swiper is actually nested —
// there's no prop to override this. Since this component sits inside AppScreen's
// paddingHorizontal, the library thinks it starts at the true screen edge (x=0)
// when it's really inset by that padding, pushing the card's right edge exactly
// to the true screen edge with zero margin. Canceling the padding with a negative
// margin here puts the Swiper's origin back where the library assumes it is, and
// the card fills 100% of the library's own (now-correct) computed width instead
// of fighting it with a second, separately-computed width.
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = Math.min(560, SCREEN_HEIGHT * 0.64);
// Footer must fit a title line + up to 2 description lines + vertical padding —
// too little room here clips the description text (title ~22px + 2×18px lines + 2×16px padding).
const CARD_FOOTER_HEIGHT = 110;
const CARD_IMAGE_HEIGHT = CARD_HEIGHT - CARD_FOOTER_HEIGHT;

export function HaircutSwipeDeck({ options, onSwipedRight, onSwipedLeft, onSwipedAll }: HaircutSwipeDeckProps) {
  return (
    <View style={{ height: CARD_HEIGHT + 40, marginHorizontal: -spacing.lg }}>
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
              height: CARD_HEIGHT,
              overflow: 'hidden',
              width: '100%',
            }}>
            <View style={{ backgroundColor: theme.colors.card, height: CARD_IMAGE_HEIGHT, width: '100%' }}>
              {option.imageUrl ? (
                <Image
                  contentFit="contain"
                  source={{ uri: option.imageUrl }}
                  style={{ height: '100%', width: '100%' }}
                />
              ) : null}
            </View>
            <View style={{ backgroundColor: theme.colors.surface, height: CARD_FOOTER_HEIGHT, gap: 4, padding: spacing.md }}>
              <AppText variant="sectionTitle" numberOfLines={1}>{option.styleLabel}</AppText>
              <AppText tone="muted" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{option.styleSummary}</AppText>
            </View>
          </View>
        )}
        onSwipedRight={onSwipedRight}
        onSwipedLeft={onSwipedLeft}
        onSwipedAll={onSwipedAll}
        cardIndex={0}
        stackSize={3}
        stackSeparation={14}
        cardHorizontalMargin={spacing.lg}
        cardVerticalMargin={20}
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
