import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, useWindowDimensions, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

const logo = require('@/logo.png');

export default function AuthWelcomeScreen() {
  const { theme } = useTheme();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApple() {
    setError(null);
    setLoadingProvider('apple');
    const { error: err } = await signInWithApple();
    setLoadingProvider(null);
    if (err) setError(err);
  }

  async function handleGoogle() {
    setError(null);
    setLoadingProvider('google');
    const { error: err } = await signInWithGoogle();
    setLoadingProvider(null);
    if (err) setError(err);
  }

  const isLoading = loadingProvider !== null;
  const { width } = useWindowDimensions();
  const logoSize = (width - 48) * 0.75;

  return (
    <AppScreen scrollable>
      <View style={{ flex: 1, gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Brand header */}
        <View style={{ alignItems: 'center', gap: 6, paddingTop: 24 }}>
          <Image
            source={logo}
            style={{ height: logoSize, width: logoSize }}
            resizeMode="contain"
          />
          <AppText tone="muted" style={{ lineHeight: 22, textAlign: 'center' }}>
            Personal style, intelligently arranged.
          </AppText>
        </View>

        {/* Social sign-in */}
        <View style={{ gap: spacing.sm }}>
          <SocialButton
            icon="logo-apple"
            label="Continue with Apple"
            loading={loadingProvider === 'apple'}
            disabled={isLoading}
            onPress={handleApple}
            style={{
              backgroundColor: theme.dark ? '#FFFFFF' : '#000000',
              borderColor: theme.dark ? '#FFFFFF' : '#000000',
            }}
            textColor={theme.dark ? '#000000' : '#FFFFFF'}
            iconColor={theme.dark ? '#000000' : '#FFFFFF'}
          />
          <SocialButton
            icon="logo-google"
            label="Continue with Google"
            loading={loadingProvider === 'google'}
            disabled={isLoading}
            onPress={handleGoogle}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            }}
            textColor={theme.colors.text}
            iconColor={theme.colors.text}
          />
        </View>

        {/* Divider */}
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          <AppText tone="subtle" style={{ fontSize: 12 }}>or</AppText>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
        </View>

        {/* Email options */}
        <View style={{ gap: spacing.sm }}>
          <Pressable
            disabled={isLoading}
            onPress={() => router.push('/auth/sign-up')}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              justifyContent: 'center',
              minHeight: 54,
              opacity: isLoading ? 0.6 : 1,
              paddingHorizontal: spacing.lg,
            }}>
            <AppText style={{
              color: theme.colors.inverseText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              Create account with Email
            </AppText>
          </Pressable>

          <Pressable
            disabled={isLoading}
            onPress={() => router.push('/auth/sign-in')}
            style={{
              alignItems: 'center',
              borderColor: theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 54,
              opacity: isLoading ? 0.6 : 1,
              paddingHorizontal: spacing.lg,
            }}>
            <AppText style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              Sign in with Email
            </AppText>
          </Pressable>
        </View>

        {/* Error */}
        {error ? (
          <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
            {error}
          </AppText>
        ) : null}

        {/* Footer */}
        <View style={{ flex: 1 }} />
        <AppText tone="subtle" style={{ fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </AppText>
      </View>
    </AppScreen>
  );
}

// ── Social button ──────────────────────────────────────────────────────────────

type SocialButtonProps = {
  icon: 'logo-apple' | 'logo-google';
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style: object;
  textColor: string;
  iconColor: string;
};

function SocialButton({ icon, label, loading, disabled, onPress, style, textColor, iconColor }: SocialButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          alignItems: 'center',
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          justifyContent: 'center',
          minHeight: 54,
          opacity: disabled ? 0.6 : 1,
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <Ionicons color={iconColor} name={icon} size={20} />
      )}
      <AppText style={{
        color: textColor,
        fontFamily: theme.fonts.sansMedium,
        fontSize: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      }}>
        {label}
      </AppText>
    </Pressable>
  );
}
