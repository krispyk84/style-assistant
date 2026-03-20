import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActionCard } from '@/components/cards/action-card';
import { WeatherCard } from '@/components/cards/weather-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { useCurrentWeather } from '@/hooks/use-current-weather';

function QuickAction({ icon, label, href }: { icon: keyof typeof Ionicons.glyphMap; label: string; href: string }) {
  return (
    <Link href={href as any} asChild>
      <Pressable 
        style={({ pressed }) => ({
          alignItems: 'center',
          gap: spacing.xs,
          opacity: pressed ? 0.7 : 1,
          flex: 1,
        })}>
        <View 
          style={{ 
            width: 52, 
            height: 52, 
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.sm,
          }}>
          <Ionicons name={icon} size={22} color={theme.colors.text} />
        </View>
        <AppText variant="meta" tone="muted">{label}</AppText>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { weather, isLoading, errorMessage } = useCurrentWeather();

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
        {/* Header Section */}
        <View style={{ gap: spacing.lg }}>
          <SectionHeader 
            eyebrow="Vesture"
            title="Your Style, Elevated"
            subtitle="Create outfit recommendations tailored to your wardrobe and the day ahead."
            variant="hero"
          />
        </View>

        {/* Main Action Card */}
        <ActionCard
          title="Create a Look"
          description="Start with an anchor piece and get AI-powered outfit recommendations across style tiers."
          href="/(app)/create-look"
          icon="sparkles-outline"
          variant="featured"
        />

        {/* Quick Actions */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" tone="subtle">Quick Actions</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <QuickAction icon="calendar-outline" label="Week" href="/(app)/week" />
            <QuickAction icon="heart-outline" label="Favorites" href="/(app)/history" />
            <QuickAction icon="person-outline" label="Profile" href="/(app)/profile" />
            <QuickAction icon="options-outline" label="Settings" href="/(app)/settings" />
          </View>
        </View>

        {/* Weather Card */}
        <WeatherCard weather={weather} isLoading={isLoading} errorMessage={errorMessage} />

        {/* Tips Section */}
        <View 
          style={[
            { 
              backgroundColor: theme.colors.accentLight,
              borderRadius: theme.radius.lg,
              padding: spacing.lg,
              gap: spacing.sm,
            },
          ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="bulb-outline" size={18} color={theme.colors.accent} />
            <AppText variant="sectionTitle" tone="accent">Styling Tip</AppText>
          </View>
          <AppText variant="caption" tone="muted">
            Start with your most statement piece as the anchor item. The AI will build complementary outfits around it.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}
