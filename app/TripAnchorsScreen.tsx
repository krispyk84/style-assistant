import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { AutoPanel } from '@/components/trip-anchors/AutoPanel';
import { GuidedPanel } from '@/components/trip-anchors/GuidedPanel';
import { ManualPanel } from '@/components/trip-anchors/ManualPanel';
import { SourcePickerSheet } from '@/components/trip-anchors/SourcePickerSheet';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { parseTripAnchorMode } from '@/lib/trip-route';
import { useTripAnchorData } from './useTripAnchorData';
import { useTripAnchorSelection } from './useTripAnchorSelection';
import { useTripAnchorSubmit } from './useTripAnchorSubmit';

export function TripAnchorsScreen() {
  const { theme } = useTheme();

  // Mode is selected on the preceding /trip-mode screen and passed as a URL param
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = parseTripAnchorMode(modeParam);

  const {
    draft,
    draftError,
    closetItems,
    hasClosetItems,
    closetLoaded,
    tripCtx,
    recommendation,
  } = useTripAnchorData();
  const {
    guidedAnchors,
    setGuidedAnchors,
    extraGuidedSlots,
    autoAnchors,
    autoLoadState,
    manualAnchors,
    setManualAnchors,
    activeAnchors,
    manualExceedsCap,
    canContinue,
    closetPickerVisible,
    setClosetPickerVisible,
    sourceSheetVisible,
    setSourceSheetVisible,
    openSourceSheet,
    handlePickCamera,
    handlePickLibrary,
    handlePickCloset,
    handleClosetItemSelected,
    handleAddGuidedSlot,
    handleAutoRetry,
    handleAutoReplace,
    handleAddAutoAnchor,
  } = useTripAnchorSelection({
    mode,
    recommendation,
    tripCtx,
    closetItems,
    closetLoaded,
    numDays: draft?.numDays,
  });
  const canSubmitAnchors = Boolean(draft) && canContinue;
  const {
    isGenerating,
    generateError,
    handleContinue,
  } = useTripAnchorSubmit({
    draft,
    mode,
    canContinue: canSubmitAnchors,
    activeAnchors,
  });

  if (draftError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            Trip details not found. Please go back and try again.
          </AppText>
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            }}>
            <AppText style={{ color: theme.colors.inverseText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              Go Back
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
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
            <AppText variant="heroSmall">
              {mode === 'guided' ? 'Guided Anchors'
               : mode === 'auto' ? 'Auto-Selected Anchors'
               : 'Pick Your Anchors'}
            </AppText>
            <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
              {mode === 'guided'
                ? 'Fill each slot Vesture recommends for your trip.'
                : mode === 'auto'
                  ? 'Review what Vesture picked from your closet.'
                  : 'Choose the core pieces for your trip.'}
            </AppText>
            {draft && (
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 12, marginTop: 4 }}>
                {draft.destinationLabel} · {draft.numDays} day{draft.numDays !== 1 ? 's' : ''}
              </AppText>
            )}
          </View>
        </View>

        {/* ── Mode-specific anchor panels ───────────────────────────────── */}
        {recommendation && (
          <>
            {mode === 'guided' && draft && (
              <GuidedPanel
                recommendation={recommendation}
                guidedAnchors={guidedAnchors}
                extraSlots={extraGuidedSlots}
                numDays={draft.numDays}
                onAddToSlot={(slotId) => openSourceSheet(slotId, 'guided')}
                onClearSlot={(slotId) => setGuidedAnchors((prev) => {
                  const next = { ...prev };
                  delete next[slotId];
                  return next;
                })}
                onAddExtraSlot={handleAddGuidedSlot}
              />
            )}

            {mode === 'auto' && draft && (
              <AutoPanel
                loadState={autoLoadState}
                anchors={autoAnchors}
                numDays={draft.numDays}
                onRetry={handleAutoRetry}
                onReplace={handleAutoReplace}
                onAddAnchor={handleAddAutoAnchor}
              />
            )}

            {mode === 'manual' && draft && (
              <ManualPanel
                anchors={manualAnchors}
                recommendation={recommendation}
                numDays={draft.numDays}
                onAdd={() => openSourceSheet('__manual__', 'manual')}
                onRemove={(id) => setManualAnchors((prev) => prev.filter((a) => a.id !== id))}
              />
            )}
          </>
        )}

        {/* Loading state while draft loads */}
        {!draft && !draftError && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        )}

        {/* Error */}
        {generateError && (
          <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
            {generateError}
          </AppText>
        )}
        {manualExceedsCap && (
          <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>
            You have reached the maximum number of anchors for this trip.
          </AppText>
        )}

      </ScrollView>

      {/* ── Fixed bottom CTA ─────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.xs,
      }}>
        {mode === 'guided' && recommendation && (() => {
          const required = recommendation.slots.filter((s) => s.required);
          const filled = required.filter((s) => guidedAnchors[s.id]);
          const remaining = required.length - filled.length;
          if (remaining > 0) {
            return (
              <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textAlign: 'center' }}>
                {remaining} recommended slot{remaining !== 1 ? 's' : ''} unfilled — you can still continue
              </AppText>
            );
          }
          return null;
        })()}

        <Pressable
          disabled={!canSubmitAnchors || isGenerating}
          onPress={() => void handleContinue()}
          style={{
            backgroundColor: canSubmitAnchors && !isGenerating ? theme.colors.text : theme.colors.subtleSurface,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
          }}>
          {isGenerating ? (
            <ActivityIndicator size="small" color={theme.colors.inverseText} />
          ) : (
            <AppIcon
              name="sparkles"
              color={canSubmitAnchors ? theme.colors.inverseText : theme.colors.subtleText}
              size={15}
            />
          )}
          <AppText style={{
            color: canSubmitAnchors && !isGenerating ? theme.colors.inverseText : theme.colors.subtleText,
            fontFamily: theme.fonts.sansMedium,
            fontSize: 14,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            {isGenerating ? 'Building Your Plan…' : 'Continue to Outfit Plan'}
          </AppText>
        </Pressable>
      </View>

      {/* Source picker sheet */}
      <SourcePickerSheet
        visible={sourceSheetVisible}
        hasCloset={hasClosetItems}
        onPickCamera={handlePickCamera}
        onPickLibrary={handlePickLibrary}
        onPickCloset={handlePickCloset}
        onDismiss={() => setSourceSheetVisible(false)}
      />

      {/* Closet picker modal */}
      <ClosetPickerModal
        visible={closetPickerVisible}
        items={closetItems}
        onSelect={handleClosetItemSelected}
        onClose={() => setClosetPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
export { TripAnchorsScreen as default };
