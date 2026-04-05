import { useState } from 'react';
import { Pressable, TextInput as RNTextInput, View, type TextInputProps as RNTextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type TextInputProps = {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
} & Omit<RNTextInputProps, 'style'>;

/**
 * Themed text input that matches the app's visual language.
 * Supports label, error message, and password reveal toggle.
 */
export function TextInput({ label, error, secureTextEntry = false, ...rest }: TextInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.danger : isFocused ? theme.colors.accent : theme.colors.border,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}>
        <RNTextInput
          {...rest}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          autoCorrect={rest.autoCorrect ?? false}
          placeholderTextColor={theme.colors.subtleText}
          secureTextEntry={secureTextEntry && !isRevealed}
          style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.fonts.sans,
            fontSize: 16,
            paddingVertical: 2,
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur?.(e);
          }}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus?.(e);
          }}
        />
        {secureTextEntry ? (
          <Pressable hitSlop={8} onPress={() => setIsRevealed((v) => !v)}>
            <Ionicons
              color={theme.colors.subtleText}
              name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
              size={18}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</AppText>
      ) : null}
    </View>
  );
}
