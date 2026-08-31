import { Pressable, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SensitivitySlider } from '@/components/ui/sensitivity-slider';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme, type AppearanceMode } from '@/contexts/theme-context';
import { useLogout } from './useLogout';
import { useSettings } from './useSettings';

// ── Constants ──────────────────────────────────────────────────────────────────

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string; description: string }[] = [
  { value: 'light',  label: 'Light',  description: 'Always use light mode' },
  { value: 'dark',   label: 'Dark',   description: 'Always use dark mode' },
  { value: 'system', label: 'System', description: 'Follow device setting' },
];

// ── Screen ─────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const { user } = useAuth();
  const { theme, appearanceMode, setAppearanceMode } = useTheme();
  const {
    sensitivity, setSensitivity, persistSensitivity, sensitivityLabel,
    trendiness, setTrendiness, persistTrendiness, trendinessLabel,
    monthlyAiCost, appVersion,
    isRefreshingTrends, trendsRefreshMessage, refreshSeasonalTrends,
    isCheckingCloudBackup, cloudBackupMessage, checkCloudBackupStatus,
    isCheckingSupabaseDirect, supabaseDirectMessage, checkSupabaseDirectStatus, checkPayloadSize,
    authEventLogMessage, viewAuthEventLog, resetAuthEventLog,
  } = useSettings();
  const { handleLogout } = useLogout();

  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  } as const;

  return (
    <AppScreen scrollable bounces={false}>
      <View style={{ gap: spacing.xl }}>
        <AppText variant="heroSmall">Settings</AppText>

        {/* Appearance */}
        <View style={cardStyle}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Appearance</AppText>
            <AppText tone="muted">Choose how the app looks.</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {APPEARANCE_OPTIONS.map((option) => {
              const isSelected = appearanceMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => void setAppearanceMode(option.value)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    backgroundColor: isSelected ? theme.colors.accent : theme.colors.subtleSurface,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    gap: 4,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.md,
                  }}>
                  <AppText
                    style={{
                      fontFamily: theme.fonts.sansMedium,
                      fontSize: 13,
                      color: isSelected ? theme.colors.inverseText : theme.colors.text,
                    }}>
                    {option.label}
                  </AppText>
                  <AppText
                    style={{
                      fontSize: 10,
                      textAlign: 'center',
                      color: isSelected ? theme.colors.inverseText : theme.colors.subtleText,
                    }}>
                    {option.description}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Closet Match Sensitivity */}
        <View style={cardStyle}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Closet Match Sensitivity</AppText>
            <AppText tone="muted">
              Controls how strictly outfit suggestions match items in your closet. Category matching is always strict — this tunes color and shade tolerance.
            </AppText>
          </View>

          <SensitivitySlider
            value={sensitivity}
            onChange={setSensitivity}
            onChangeEnd={(v) => void persistSensitivity(v)}
            accessibilityLabel="Closet match sensitivity"
          />

          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText tone="muted" style={{ fontSize: 12 }}>Forgiving</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Precise</AppText>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: 12,
              borderWidth: 1,
              padding: spacing.sm,
            }}>
            <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
              {sensitivityLabel}
            </AppText>
          </View>
        </View>

        {/* Trendiness */}
        <View style={cardStyle}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Trendiness</AppText>
            <AppText tone="muted">
              Tunes how current vs. timeless your generated outfits feel. Lower leans into safe wardrobe classics; higher leans into current micro-trends and statement details.
            </AppText>
          </View>

          <SensitivitySlider
            value={trendiness}
            onChange={setTrendiness}
            onChangeEnd={(v) => void persistTrendiness(v)}
            accessibilityLabel="Outfit trendiness"
          />

          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText tone="muted" style={{ fontSize: 12 }}>Safe</AppText>
            <AppText tone="muted" style={{ fontSize: 12 }}>Trendy</AppText>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: 12,
              borderWidth: 1,
              padding: spacing.sm,
            }}>
            <AppText tone="muted" style={{ fontSize: 13, textAlign: 'center' }}>
              {trendinessLabel}
            </AppText>
          </View>
        </View>

        {/* App version */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.sm,
            padding: spacing.lg,
          }}>
          <AppText variant="sectionTitle">App version</AppText>
          <AppText tone="muted">Vesture {appVersion}</AppText>
          {user?.email ? (
            <AppText tone="subtle" style={{ fontSize: 12 }}>Signed in as {user.email}</AppText>
          ) : null}
          {monthlyAiCost !== null ? (
            <AppText tone="subtle" style={{ fontSize: 12 }}>AI usage this month: ${monthlyAiCost.toFixed(2)}</AppText>
          ) : null}
        </View>

        {/* Debug — advanced tools */}
        <View style={cardStyle}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Debug</AppText>
            <AppText tone="muted">Advanced tools for troubleshooting.</AppText>
          </View>
          <Pressable
            disabled={isRefreshingTrends}
            onPress={() => void refreshSeasonalTrends()}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.subtleSurface,
              borderColor: theme.colors.border,
              borderRadius: 16,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 48,
              opacity: isRefreshingTrends ? 0.6 : 1,
              paddingHorizontal: spacing.md,
            }}>
            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              {isRefreshingTrends ? 'Requesting refresh…' : 'Refresh Seasonal Fashion Trends'}
            </AppText>
          </Pressable>
          {trendsRefreshMessage ? (
            <AppText tone="muted" style={{ fontSize: 12 }}>{trendsRefreshMessage}</AppText>
          ) : null}
          <Pressable
            disabled={isCheckingCloudBackup}
            onPress={() => void checkCloudBackupStatus()}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.subtleSurface,
              borderColor: theme.colors.border,
              borderRadius: 16,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 48,
              opacity: isCheckingCloudBackup ? 0.6 : 1,
              paddingHorizontal: spacing.md,
            }}>
            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              {isCheckingCloudBackup ? 'Checking…' : 'Check Cloud Backup Status'}
            </AppText>
          </Pressable>
          {cloudBackupMessage ? (
            <AppText tone="muted" style={{ fontSize: 12 }}>{cloudBackupMessage}</AppText>
          ) : null}
          <Pressable
            disabled={isCheckingSupabaseDirect}
            onPress={() => void checkSupabaseDirectStatus()}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.subtleSurface,
              borderColor: theme.colors.border,
              borderRadius: 16,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 48,
              opacity: isCheckingSupabaseDirect ? 0.6 : 1,
              paddingHorizontal: spacing.md,
            }}>
            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              {isCheckingSupabaseDirect ? 'Checking…' : 'Check Supabase Directly'}
            </AppText>
          </Pressable>
          {supabaseDirectMessage ? (
            <AppText tone="muted" style={{ fontSize: 12 }}>{supabaseDirectMessage}</AppText>
          ) : null}
          <Pressable
            disabled={isCheckingSupabaseDirect}
            onPress={() => void checkPayloadSize()}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.subtleSurface,
              borderColor: theme.colors.border,
              borderRadius: 16,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 48,
              opacity: isCheckingSupabaseDirect ? 0.6 : 1,
              paddingHorizontal: spacing.md,
            }}>
            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              {isCheckingSupabaseDirect ? 'Checking…' : 'Check Saved-Outfits Payload Size'}
            </AppText>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => void viewAuthEventLog()}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 16,
                borderWidth: 1,
                flex: 1,
                justifyContent: 'center',
                minHeight: 48,
                paddingHorizontal: spacing.md,
              }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>View Auth Event Log</AppText>
            </Pressable>
            <Pressable
              onPress={() => void resetAuthEventLog()}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 16,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 48,
                paddingHorizontal: spacing.md,
              }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>Clear</AppText>
            </Pressable>
          </View>
          {authEventLogMessage ? (
            <AppText tone="muted" style={{ fontSize: 12 }}>{authEventLogMessage}</AppText>
          ) : null}
        </View>

        {/* Sign out */}
        <Pressable
          onPress={handleLogout}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.danger,
            borderRadius: 999,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 54,
            paddingHorizontal: spacing.lg,
          }}>
          <AppText style={{
            color: theme.colors.danger,
            fontFamily: theme.fonts.sansMedium,
            fontSize: 14,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}>
            Sign Out
          </AppText>
        </Pressable>

      </View>
    </AppScreen>
  );
}

