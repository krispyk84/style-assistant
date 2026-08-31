import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ClosetReadinessTracker, joinWithAnd } from '@/components/closet/ClosetReadinessTracker';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { evaluateClosetReadiness, type ClosetReadiness } from '@/lib/closet-readiness';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import type { TripDraft } from '@/lib/trip-draft-storage';
import { buildTripAnchorsHref, buildTripResultsHref, createTripId, parseTripAnchorMode } from '@/lib/trip-route';
import { closetService } from '@/services/closet';
import { saveTripPlanAnchors, saveTripPlanDraft } from '@/services/trip-plans';
import type { TripAnchorInput } from '@/services/trip-outfits';
import type { AnchorMode } from './trip-anchors-types';

const MODE_CONFIG: { id: AnchorMode; icon: AppIconName; title: string; copy: string }[] = [
  {
    id:    'guided',
    icon:  'sparkles',
    title: 'Guided',
    copy:  "Give me some direction and I'll build around it.",
  },
  {
    id:    'manual',
    icon:  'star',
    title: 'Anchors',
    copy:  'Choose key pieces you want to wear and I\'ll build outfits around them.',
  },
  {
    id:    'fullCloset',
    icon:  'closet',
    title: 'From My Closet',
    copy:  'Build the complete trip wardrobe for me using what I already own.',
  },
];

export function TripModeScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<AnchorMode>('guided');
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [readiness, setReadiness] = useState<ClosetReadiness | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  useEffect(() => {
    tripDraftStorage.load().then((d) => {
      if (d) {
        setDraft(d);
        // Restore previously selected mode so going back from trip-anchors preserves choice
        if (d.pendingAnchorMode) {
          const restored = d.pendingAnchorMode === 'fullCloset' ? 'fullCloset' : parseTripAnchorMode(d.pendingAnchorMode);
          setMode(restored);
        }
      }
    }).catch(() => {});

    void closetService.getItems().then((res) => {
      if (res.success && res.data) {
        setReadiness(evaluateClosetReadiness(res.data.items));
      }
    });
  }, []);

  // Never leave "From My Closet" selected if the closet turns out not to be
  // ready (readiness loads asynchronously, after the mode-restore above).
  useEffect(() => {
    if (readiness && !readiness.ready && mode === 'fullCloset') setMode('guided');
  }, [readiness, mode]);

  async function handleBuild() {
    if (!draft) return;

    if (mode !== 'fullCloset') {
      await tripDraftStorage.save({ ...draft, pendingAnchorMode: mode }).catch(() => {});
      router.push(buildTripAnchorsHref(mode));
      return;
    }

    // "From My Closet" has no anchor-selection step — go straight to
    // progressive per-day generation, same as Guided/Anchors do once THEY
    // finish anchor selection (see useTripAnchorSubmit.ts).
    setIsBuilding(true);
    setBuildError(null);
    try {
      const planId = await saveTripPlanDraft({
        destination: draft.destinationLabel,
        country: draft.country,
        departureDate: draft.departureDate,
        returnDate: draft.returnDate,
        numDays: draft.numDays,
        travelParty: draft.travelParty,
        purposes: draft.purposes,
        climateLabel: draft.climateLabel,
        styleVibe: draft.styleVibe,
        willSwim: draft.willSwim,
        fancyNights: draft.fancyNights,
        workoutClothes: draft.workoutClothes,
        laundryAccess: draft.laundryAccess,
        shoesCount: draft.shoesCount,
        carryOnOnly: draft.carryOnOnly,
        rewearOk: draft.rewearOk,
        activities: draft.activities,
        dressCode: draft.dressCode,
        specialNeeds: draft.specialNeeds,
        anchorMode: 'fullCloset',
      });

      const anchorInputs: TripAnchorInput[] = draft.pendingAnchors ?? [];
      if (planId) void saveTripPlanAnchors(planId, 'fullCloset', anchorInputs);

      await tripDraftStorage.save({ ...draft, pendingAnchorMode: 'fullCloset' });

      const tripId = createTripId();
      router.push(buildTripResultsHref({
        tripId,
        destination: draft.destinationLabel,
        isProgressiveGeneration: true,
      }));
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsBuilding(false);
    }
  }

  const visibleModes = readiness?.ready ? MODE_CONFIG : MODE_CONFIG.filter((m) => m.id !== 'fullCloset');

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
            <AppText variant="heroSmall">How should I build your outfits?</AppText>
            {draft && (
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 12, marginTop: 4 }}>
                {draft.destinationLabel} · {draft.numDays} day{draft.numDays !== 1 ? 's' : ''}
              </AppText>
            )}
          </View>
        </View>

        {/* Mode options — big selectable cards, not radio rows */}
        <View style={{ gap: spacing.sm }}>
          {visibleModes.map((m) => {
            const isActive = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor:     isActive ? theme.colors.text : theme.colors.border,
                  borderRadius: 20,
                  borderWidth: isActive ? 2 : 1,
                  padding: spacing.lg,
                  gap: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: isActive ? theme.colors.text : theme.colors.subtleSurface,
                    borderRadius: 22,
                    height: 44,
                    justifyContent: 'center',
                    width: 44,
                  }}>
                  <AppIcon color={isActive ? theme.colors.inverseText : theme.colors.subtleText} name={m.icon} size={20} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 16 }}>{m.title}</AppText>
                  <AppText tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{m.copy}</AppText>
                </View>
                {isActive ? <AppIcon color={theme.colors.text} name="check-circle" size={20} /> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Insufficient-closet fallback — reuses the SAME readiness result and
            progress tracker Home's "Generate Outfits From My Closet" uses;
            no separate threshold. Guided/Anchors remain fully available. */}
        {readiness && !readiness.ready ? (
          <View
            style={{
              backgroundColor: theme.colors.subtleSurface,
              borderColor: theme.colors.border,
              borderRadius: 20,
              borderWidth: 1,
              gap: spacing.md,
              padding: spacing.lg,
            }}>
            <View style={{ gap: spacing.xs }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                <AppIcon color={theme.colors.subtleText} name="closet" size={18} />
                <AppText tone="subtle" style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                  Building from your closet isn't available yet
                </AppText>
              </View>
              <AppText tone="subtle" style={{ fontSize: 12, lineHeight: 17 }}>
                Add a few more pieces to your closet and I can build entire outfits from what you own. You&apos;re missing{' '}
                {joinWithAnd(readiness.missing)}. For now, Guided and Anchors can still suggest new pieces alongside what you have.
              </AppText>
            </View>
            <ClosetReadinessTracker progress={readiness.progress} />
          </View>
        ) : readiness === null ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
            <ActivityIndicator color={theme.colors.mutedText} size="small" />
          </View>
        ) : null}

        {buildError ? (
          <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>{buildError}</AppText>
        ) : null}

      </ScrollView>

      {/* Fixed CTA */}
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
          disabled={isBuilding}
          onPress={() => void handleBuild()}
          style={{
            backgroundColor: theme.colors.text,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: isBuilding ? 0.6 : 1,
            paddingVertical: spacing.md,
          }}>
          {isBuilding ? null : <AppIcon name="arrow-right" color={theme.colors.inverseText} size={15} />}
          <AppText style={{
            color: theme.colors.inverseText,
            fontFamily: theme.fonts.sansMedium,
            fontSize: 14,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            {isBuilding ? 'Building Your Wardrobe…' : 'Build My Travel Wardrobe'}
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
