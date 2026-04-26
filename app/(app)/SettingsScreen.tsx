import { useRef } from 'react';
import { PanResponder, Pressable, View, type DimensionValue } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
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
  const { sensitivity, handleSensitivityChange, monthlyAiCost, sensitivityLabel, appVersion } = useSettings();
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
    <AppScreen scrollable floatingBack>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 2 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">Settings</AppText>
          <AppText tone="muted">App details and preferences.</AppText>
        </View>

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
                      color: isSelected ? '#FFFFFF' : theme.colors.text,
                    }}>
                    {option.label}
                  </AppText>
                  <AppText
                    style={{
                      fontSize: 10,
                      textAlign: 'center',
                      color: isSelected ? 'rgba(255,255,255,0.75)' : theme.colors.subtleText,
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

          <SensitivitySlider value={sensitivity} onChange={(v) => void handleSensitivityChange(v)} />

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

// ── Sensitivity slider ─────────────────────────────────────────────────────────

function SensitivitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { theme } = useTheme();
  const trackMetrics = useRef({ x: 0, width: 1 });
  const trackRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (evt) => {
        const ratio = (evt.nativeEvent.pageX - trackMetrics.current.x) / trackMetrics.current.width;
        onChange(Math.round(Math.min(100, Math.max(0, ratio * 100))));
      },
      onPanResponderMove: (evt) => {
        const ratio = (evt.nativeEvent.pageX - trackMetrics.current.x) / trackMetrics.current.width;
        onChange(Math.round(Math.min(100, Math.max(0, ratio * 100))));
      },
    })
  ).current;

  const thumbPercent = `${value}%` as DimensionValue;

  return (
    <View
      ref={trackRef}
      {...panResponder.panHandlers}
      onLayout={() => {
        trackRef.current?.measureInWindow((x, _y, width) => {
          trackMetrics.current = { x, width: width || 1 };
        });
      }}
      style={{ height: 44, justifyContent: 'center' }}>

      <View
        style={{
          borderRadius: 4,
          backgroundColor: theme.colors.border,
          height: 6,
          overflow: 'hidden',
        }}>
        <View
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: 4,
            height: '100%',
            width: thumbPercent,
          }}
        />
      </View>

      <View
        pointerEvents="none"
        style={{
          backgroundColor: theme.colors.text,
          borderRadius: 11,
          height: 22,
          left: thumbPercent,
          position: 'absolute',
          transform: [{ translateX: -11 }],
          width: 22,
        }}
      />
    </View>
  );
}
