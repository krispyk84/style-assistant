import { type ReactNode } from 'react';
import { Image, type ImageSourcePropType, Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type SelectorCardProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Real sketch or thumbnail image. When provided, fills the thumbnail area. */
  image?: ImageSourcePropType;
  /** How the image fits its container. Defaults to 'contain'. Use 'cover' to crop portraits. */
  imageResizeMode?: 'contain' | 'cover';
  /** Custom content rendered inside the thumbnail area when no image is supplied. */
  thumbnailContent?: ReactNode;
  /** Height of the thumbnail area. Defaults to 110. */
  thumbnailHeight?: number;
};

export function SelectorCard({
  label,
  selected,
  onPress,
  image,
  imageResizeMode = 'contain',
  thumbnailContent,
  thumbnailHeight = 110,
}: SelectorCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? '#FBF4EA' : theme.colors.surface,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        borderRadius: 20,
        borderWidth: selected ? 2 : 1,
        flex: 1,
        overflow: 'hidden',
      }}>
      {/* Thumbnail */}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.subtleSurface,
          height: thumbnailHeight,
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        {image ? (
          <Image source={image} style={{ height: '100%', width: '100%' }} resizeMode={imageResizeMode} />
        ) : (
          thumbnailContent ?? <DefaultPlaceholder label={label} />
        )}
      </View>

      {/* Label */}
      <View style={{ alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm }}>
        <AppText
          style={{
            color: selected ? theme.colors.accent : theme.colors.text,
            fontFamily: selected ? theme.fonts.sansMedium : theme.fonts.sans,
            fontSize: 13,
            textAlign: 'center',
            textTransform: 'capitalize',
          }}>
          {label.replaceAll('-', ' ')}
        </AppText>
      </View>
    </Pressable>
  );
}

function DefaultPlaceholder({ label }: { label: string }) {
  return (
    <AppText
      style={{
        color: theme.colors.subtleText,
        fontFamily: theme.fonts.serif,
        fontSize: 36,
        opacity: 0.4,
        textTransform: 'uppercase',
      }}>
      {label.charAt(0)}
    </AppText>
  );
}
