import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { TripDraft } from '@/lib/trip-draft-storage';

type AnchorMode = 'guided' | 'auto' | 'manual';

const MODE_CONFIG: { id: AnchorMode; title: string; label: string; copy: string }[] = [
  {
    id:    'guided',
    title: 'Guided',
    label: 'We recommend anchors for this trip.',
    copy:  'Vesture guides you to the right number and types of core pieces.',
  },
  {
    id:    'auto',
    title: 'Auto',
    label: 'Let Vesture choose anchors for me.',
    copy:  'AI selects the strongest anchor set based on your trip and closet.',
  },
  {
    id:    'manual',
    title: 'Manual',
    label: "I'll pick my own anchors.",
    copy:  'Choose your own core pieces from your closet or camera.',
  },
];

export function TripModeScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<AnchorMode>('guided');
  const [draft, setDraft] = useState<TripDraft | null>(null);

  useEffect(() => {
    tripDraftStorage.load().then((d) => {
      if (d) {
        setDraft(d);
        // Restore previously selected mode so going back from trip-anchors preserves choice
        if (d.pendingAnchorMode) setMode(d.pendingAnchorMode);
      }
    }).catch(() => {});
  }, []);

  async function handleNext() {
    // Persist mode selection into the draft so it survives back-navigation
    if (draft) {
      await tripDraftStorage.save({ ...draft, pendingAnchorMode: mode }).catch(() => {});
    }
    router.push({ pathname: '/trip-anchors', params: { mode } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.xs, marginTop: 2 }}>
            <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heroSmall">Choose Your Anchors</AppText>
            <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
              How would you like to pick the key pieces for this trip?
            </AppText>
            {draft && (
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 12, marginTop: 4 }}>
                {draft.destinationLabel} · {draft.numDays} day{draft.numDays !== 1 ? 's' : ''}
              </AppText>
            )}
          </View>
        </View>

        {/* Mode options */}
        <View style={{ gap: spacing.sm }}>
          {MODE_CONFIG.map((m) => {
            const isActive = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={{
                  backgroundColor: isActive ? theme.colors.surface : theme.colors.background,
                  borderColor:     isActive ? theme.colors.text : theme.colors.border,
                  borderRadius: 18,
                  borderWidth: isActive ? 2 : 1,
                  padding: spacing.lg,
                  gap: spacing.xs,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                }}>
                {/* Radio indicator */}
                <View style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 2,
                  borderColor: isActive ? theme.colors.text : theme.colors.border,
                  backgroundColor: isActive ? theme.colors.text : 'transparent',
                  marginTop: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isActive && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.inverseText }} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <AppText style={{
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 15,
                    color: isActive ? theme.colors.text : theme.colors.mutedText,
                  }}>
                    {m.title}
                  </AppText>
                  <AppText style={{
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 13,
                    color: isActive ? theme.colors.text : theme.colors.mutedText,
                  }}>
                    {m.label}
                  </AppText>
                  <AppText style={{ color: theme.colors.subtleText, fontSize: 12, lineHeight: 17 }}>
                    {m.copy}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>

      {/* Fixed Next button */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.sm,
      }}>
        <Pressable
          onPress={() => void handleNext()}
          style={{
            backgroundColor: theme.colors.text,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
          }}>
          <AppIcon name="arrow-right" color={theme.colors.inverseText} size={15} />
          <AppText style={{
            color: theme.colors.inverseText,
            fontFamily: theme.fonts.sansMedium,
            fontSize: 14,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            Next
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
