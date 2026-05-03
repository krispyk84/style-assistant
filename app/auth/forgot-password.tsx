import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { TextInput } from '@/components/ui/text-input';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const { sendPasswordResetEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setIsLoading(true);
    // sendPasswordResetEmail always returns { error: null } — we never reveal
    // whether the email exists in our system.
    await sendPasswordResetEmail(email.trim());
    setIsLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AppScreen scrollable>
        <View style={{ flex: 1, gap: spacing.xl, paddingTop: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 2 }}>
              Email sent
            </AppText>
            <AppText variant="heroSmall">Check your{'\n'}inbox.</AppText>
          </View>
          <AppText tone="muted" style={{ lineHeight: 24 }}>
            If an account exists for that address, we&apos;ve sent a password reset link.
            The link expires after one hour.
          </AppText>
          <Pressable
            onPress={() => router.replace('/auth/sign-in')}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              justifyContent: 'center',
              minHeight: 54,
              paddingHorizontal: spacing.lg,
            }}>
            <AppText style={{
              color: theme.colors.inverseText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              Back to Sign In
            </AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs, paddingTop: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 2 }}>
            Reset password
          </AppText>
          <AppText variant="heroSmall">Forgot your{'\n'}password?</AppText>
          <AppText tone="muted" style={{ lineHeight: 22 }}>
            Enter the email address associated with your account and we&apos;ll send you a reset link.
          </AppText>
        </View>

        {/* Form */}
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@example.com"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          error={emailError ?? undefined}
        />

        {/* Submit */}
        <Pressable
          disabled={isLoading}
          onPress={handleSubmit}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.text,
            borderRadius: 999,
            justifyContent: 'center',
            minHeight: 54,
            opacity: isLoading ? 0.6 : 1,
            paddingHorizontal: spacing.lg,
          }}>
          {isLoading ? (
            <ActivityIndicator color={theme.colors.inverseText} />
          ) : (
            <AppText style={{
              color: theme.colors.inverseText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
              Send Reset Link
            </AppText>
          )}
        </Pressable>

        {/* Back */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText tone="muted" style={{ fontSize: 14 }}>
              Back to{' '}
              <AppText style={{ color: theme.colors.accent, fontSize: 14 }}>Sign In</AppText>
            </AppText>
          </Pressable>
        </View>

      </View>
    </AppScreen>
  );
}
