import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { SelectorCard } from '@/components/ui/selector-card';
import { spacing, theme } from '@/constants/theme';
import type { Profile } from '@/types/profile';
import { ALESSANDRA_IMAGE, VITTORIO_IMAGE } from './onboarding-assets';

type Props = {
  selected: Profile['gender'] | undefined;
  onSelect: (gender: Profile['gender']) => void;
};

export function OnboardingStepGender({ selected, onSelect }: Props) {
  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
        <SelectorCard
          label="Man"
          selected={selected === 'man'}
          onPress={() => onSelect('man')}
          image={VITTORIO_IMAGE}
          imageResizeMode="cover"
          thumbnailHeight={220}
        />
        <SelectorCard
          label="Woman"
          selected={selected === 'woman'}
          onPress={() => onSelect('woman')}
          image={ALESSANDRA_IMAGE}
          imageResizeMode="cover"
          thumbnailHeight={220}
        />
      </View>
      <Pressable
        onPress={() => onSelect('non-binary')}
        hitSlop={12}
        style={{ paddingVertical: spacing.xs }}>
        <AppText
          style={{
            color: selected === 'non-binary' ? theme.colors.accent : theme.colors.subtleText,
            fontFamily: selected === 'non-binary' ? theme.fonts.sansMedium : theme.fonts.sans,
            fontSize: 14,
            textDecorationLine: 'underline',
          }}>
          Non-Binary / Prefer Not to Say
        </AppText>
      </Pressable>
    </View>
  );
}
