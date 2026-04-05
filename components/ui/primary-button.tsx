import { Href, Link } from 'expo-router';
import { GestureResponderEvent, Pressable, StyleProp, Text, ViewStyle } from 'react-native';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type PrimaryButtonProps = {
  label: string;
  href?: Href;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, href, onPress, variant = 'primary', disabled = false, style }: PrimaryButtonProps) {
  const { theme } = useTheme();
  const backgroundColor = variant === 'primary' ? theme.colors.text : theme.colors.surface;
  const textColor = variant === 'primary' ? theme.colors.inverseText : theme.colors.text;

  const button = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          alignItems: 'center',
          backgroundColor,
          borderColor: theme.colors.border,
          borderRadius: 999,
          borderWidth: variant === 'secondary' ? 1 : 0,
          minHeight: 54,
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}>
      <Text
        style={{
          color: textColor,
          fontFamily: theme.fonts.sansMedium,
          fontSize: 14,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </Pressable>
  );

  if (!href) {
    return button;
  }

  return (
    <Link href={href} asChild>
      {button}
    </Link>
  );
}
