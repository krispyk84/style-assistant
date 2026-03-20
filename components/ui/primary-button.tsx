import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { GestureResponderEvent, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';

import { spacing, theme } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  href?: Href;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'default' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantStyles = {
  primary: {
    backgroundColor: theme.colors.text,
    textColor: theme.colors.surface,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    textColor: theme.colors.text,
    borderWidth: 1,
  },
  accent: {
    backgroundColor: theme.colors.accent,
    textColor: theme.colors.surface,
    borderWidth: 0,
  },
  ghost: {
    backgroundColor: 'transparent',
    textColor: theme.colors.text,
    borderWidth: 0,
  },
};

export function PrimaryButton({ 
  label, 
  href, 
  onPress, 
  variant = 'primary', 
  size = 'default',
  icon,
  iconPosition = 'right',
  disabled = false, 
  style 
}: PrimaryButtonProps) {
  const styles = variantStyles[variant];
  const isLarge = size === 'large';
  const iconColor = styles.textColor;

  const button = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: styles.backgroundColor,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.full,
          borderWidth: styles.borderWidth,
          minHeight: isLarge ? 60 : 52,
          gap: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          paddingHorizontal: isLarge ? spacing.xl : spacing.lg,
        },
        variant !== 'ghost' && theme.shadows.sm,
        style,
      ]}>
      {icon && iconPosition === 'left' && (
        <Ionicons name={icon} size={isLarge ? 20 : 18} color={iconColor} />
      )}
      <Text
        style={{
          color: styles.textColor,
          fontFamily: theme.fonts.sansMedium,
          fontSize: isLarge ? 15 : 14,
          fontWeight: '600',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
      {icon && iconPosition === 'right' && (
        <Ionicons name={icon} size={isLarge ? 20 : 18} color={iconColor} />
      )}
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
