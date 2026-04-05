import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { TextInput } from '@/components/ui/text-input';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

export default function SignInScreen() {
  const { theme } = useTheme();
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

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
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    const { error } = await signInWithEmail(email.trim(), password);
    setIsLoading(false);

    if (error) {
      // Use a generic message to avoid revealing whether the email is registered.
      setErrors({ general: 'Incorrect email or password. Please try again.' });
    }
    // On success the onAuthStateChange listener in AuthProvider triggers navigation.
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs, paddingTop: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 2 }}>
            Welcome back
          </AppText>
          <AppText variant="heroSmall">Sign in to{'\n'}your account.</AppText>
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
            textContentType="password"
            autoComplete="current-password"
            placeholder="Your password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={errors.password}
          />
        </View>

        {/* Forgot password */}
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.push('/auth/forgot-password')} hitSlop={8}>
            <AppText style={{ color: theme.colors.accent, fontSize: 14 }}>
              Forgot password?
            </AppText>
          </Pressable>
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
              Sign In
            </AppText>
          )}
        </Pressable>

        {/* Sign-up link */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => router.replace('/auth/sign-up')} hitSlop={8}>
            <AppText tone="muted" style={{ fontSize: 14 }}>
              No account yet?{' '}
              <AppText style={{ color: theme.colors.accent, fontSize: 14 }}>Create one</AppText>
            </AppText>
          </Pressable>
        </View>

        {/* Back to welcome */}
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={() => router.replace('/auth')} hitSlop={8}>
            <AppText tone="subtle" style={{ fontSize: 13 }}>
              Other sign-in options
            </AppText>
          </Pressable>
        </View>

      </View>
    </AppScreen>
  );
}
