import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { TextInput } from '@/components/ui/text-input';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

export default function SignUpScreen() {
  const { theme } = useTheme();
  const { signUpWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string; general?: string }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function validate(): boolean {
    const next: typeof errors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = 'Please enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      next.confirm = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      next.confirm = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    const { error } = await signUpWithEmail(email.trim(), password);
    setIsLoading(false);

    if (error) {
      setErrors({ general: error });
      return;
    }

    // Supabase sends a confirmation email by default.
    // Show a confirmation message instead of navigating immediately.
    setSuccessMessage(
      'Check your email for a confirmation link, then sign in.'
    );
  }

  if (successMessage) {
    return (
      <AppScreen scrollable>
        <View style={{ flex: 1, gap: spacing.xl, paddingTop: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 2 }}>
              Almost there
            </AppText>
            <AppText variant="heroSmall">Check your{'\n'}inbox.</AppText>
          </View>
          <AppText tone="muted" style={{ lineHeight: 24 }}>
            {successMessage}
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
              Go to Sign In
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
            New account
          </AppText>
          <AppText variant="heroSmall">Create your{'\n'}account.</AppText>
          <AppText tone="muted" style={{ lineHeight: 22 }}>
            Your style data stays private and linked to your account.
          </AppText>
        </View>

        {/* Form */}
        <View style={{ gap: spacing.md }}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="you@example.com"
            returnKeyType="next"
            error={errors.email}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            returnKeyType="next"
            error={errors.password}
          />
          <TextInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Repeat your password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={errors.confirm}
          />
        </View>

        {/* General error */}
        {errors.general ? (
          <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>
            {errors.general}
          </AppText>
        ) : null}

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
              Create Account
            </AppText>
          )}
        </Pressable>

        {/* Sign-in link */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => router.replace('/auth/sign-in')} hitSlop={8}>
            <AppText tone="muted" style={{ fontSize: 14 }}>
              Already have an account?{' '}
              <AppText style={{ color: theme.colors.accent, fontSize: 14 }}>Sign in</AppText>
            </AppText>
          </Pressable>
        </View>

      </View>
    </AppScreen>
  );
}
