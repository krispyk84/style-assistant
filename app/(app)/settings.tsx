import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';

const appVersion = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';

export default function SettingsScreen() {
  const { isSaving, profile, saveProfile } = useAppSession();
  const [isSavedMessageVisible, setIsSavedMessageVisible] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);

  useEffect(() => {
    void loadAppSettings().then((s) => setSensitivity(s.closetMatchSensitivity));
  }, []);

  async function handleSensitivityChange(value: number) {
    setSensitivity(value);
    await saveAppSettings({ closetMatchSensitivity: value });
  }

  const sensitivityLabel =
    sensitivity >= 67 ? 'Precise — close color and shade required'
    : sensitivity >= 34 ? 'Balanced — same color family required'
    : 'Forgiving — broad color family accepted';

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 2 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">Settings</AppText>
          <AppText tone="muted">Profile and app details.</AppText>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            padding: spacing.lg,
          }}>
          <ProfileForm
            initialValue={profile}
            submitLabel={isSaving ? 'Saving...' : 'Save profile'}
            disabled={isSaving}
            onSubmit={async (nextProfile) => {
              await saveProfile(nextProfile, true);
              setIsSavedMessageVisible(true);
            }}
          />
          {isSavedMessageVisible ? <AppText tone="muted">Profile updated.</AppText> : null}
        </View>

        {/* Closet Match Sensitivity */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.md,
            padding: spacing.lg,
          }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Closet Match Sensitivity</AppText>
            <AppText tone="muted">
              Controls how closely outfit suggestions must match items in your closet. Category matching is always strict — this adjusts color and shade tolerance.
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
        </View>
      </View>
    </AppScreen>
  );
}

// ── Sensitivity slider ─────────────────────────────────────────────────────────

function SensitivitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackMetrics = useRef({ x: 0, width: 1 });
  const trackRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      // Claim horizontal drags; let vertical drags pass to the parent ScrollView
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

  const thumbPercent = `${value}%`;

  return (
    <View
      ref={trackRef}
      {...panResponder.panHandlers}
      onLayout={() => {
        trackRef.current?.measureInWindow((x, _y, width) => {
          trackMetrics.current = { x, width: width || 1 };
        });
      }}
      // Tall touch target so the thumb is easy to grab
      style={{ height: 44, justifyContent: 'center' }}>

      {/* Track background */}
      <View
        style={{
          borderRadius: 4,
          backgroundColor: theme.colors.border,
          height: 6,
          overflow: 'hidden',
        }}>
        {/* Filled portion */}
        <View
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: 4,
            height: '100%',
            width: thumbPercent,
          }}
        />
      </View>

      {/* Thumb */}
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
