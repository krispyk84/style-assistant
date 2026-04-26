import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { parseTripAnchorMode } from '@/lib/trip-route';
import type {
  AnchorCategory,
  AnchorRecommendation,
  AnchorSlot,
} from '@/lib/trip-anchor-recommender';
import type { SelectedAnchor } from './trip-anchors-types';
import { useTripAnchorData } from './useTripAnchorData';
import { useTripAnchorSelection } from './useTripAnchorSelection';
import { useTripAnchorSubmit } from './useTripAnchorSubmit';

// ── Sub-components ────────────────────────────────────────────────────────────

function AnchorChip({
  anchor,
  onRemove,
}: {
  anchor: SelectedAnchor;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const imageUri = anchor.closetItemImageUrl ?? anchor.localImageUri ?? anchor.imageUrl;

  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
    }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.subtleSurface }}
          resizeMode="cover"
        />
      ) : (
        <View style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: theme.colors.subtleSurface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AppIcon name="shirt" color={theme.colors.subtleText} size={18} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 13 }} numberOfLines={1}>
          {anchor.label}
        </AppText>
        <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>
          {anchor.source === 'closet' ? 'Selected from closet'
           : anchor.source === 'ai_suggested' ? 'Suggested by Vesture'
           : anchor.source === 'camera' ? 'Captured with camera'
           : 'Uploaded from library'} · {anchor.category}
        </AppText>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 4 }}>
        <AppIcon name="close" color={theme.colors.subtleText} size={14} />
      </Pressable>
    </View>
  );
}

// ── Source picker modal ───────────────────────────────────────────────────────

function SourcePickerSheet({
  visible,
  hasCloset,
  onPickCloset,
  onPickCamera,
  onPickLibrary,
  onDismiss,
}: {
  visible: boolean;
  hasCloset: boolean;
  onPickCloset: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const slideAnim   = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropAnim.setValue(0);
      slideAnim.setValue(300);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim, backdropAnim]);

  const options: { icon: string; label: string; onPress: () => void; disabled?: boolean }[] = [
    { icon: 'camera',  label: 'Take photo',            onPress: onPickCamera },
    { icon: 'upload',  label: 'Upload from library',   onPress: onPickLibrary },
    { icon: 'closet',  label: hasCloset ? 'Select from closet' : 'No closet items yet', onPress: onPickCloset, disabled: !hasCloset },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}>
      <Animated.View style={{ flex: 1, opacity: backdropAnim }}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onDismiss}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => {/* stop propagation */}}>
          <Animated.View style={{
            transform: [{ translateY: slideAnim }],
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: spacing.lg,
            gap: spacing.sm,
          }}>
            <AppText style={{
              color: theme.colors.mutedText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: spacing.xs,
            }}>
              Add anchor piece
            </AppText>

            {options.map((opt) => (
              <Pressable
                key={opt.label}
                disabled={opt.disabled}
                onPress={() => { opt.onPress(); onDismiss(); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  backgroundColor: opt.disabled ? theme.colors.subtleSurface : theme.colors.background,
                  borderColor: theme.colors.border,
                  borderRadius: 14,
                  borderWidth: 1,
                  padding: spacing.md,
                  opacity: opt.disabled ? 0.5 : 1,
                }}>
                <AppIcon name={opt.icon as any} color={opt.disabled ? theme.colors.subtleText : theme.colors.text} size={18} />
                <AppText style={{
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 14,
                  color: opt.disabled ? theme.colors.subtleText : theme.colors.text,
                }}>
                  {opt.label}
                </AppText>
              </Pressable>
            ))}

            <Pressable
              onPress={onDismiss}
              style={{
                alignItems: 'center',
                paddingVertical: spacing.md,
                marginTop: spacing.xs,
              }}>
              <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                Cancel
              </AppText>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ── Guided mode panel ─────────────────────────────────────────────────────────

function GuidedPanel({
  recommendation,
  guidedAnchors,
  extraSlots,
  numDays,
  onAddToSlot,
  onClearSlot,
  onAddExtraSlot,
}: {
  recommendation: AnchorRecommendation;
  guidedAnchors: Record<string, SelectedAnchor | undefined>;
  extraSlots: AnchorSlot[];
  numDays: number;
  onAddToSlot: (slotId: string) => void;
  onClearSlot: (slotId: string) => void;
  onAddExtraSlot: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {/* Summary card */}
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 16,
        padding: spacing.md,
        gap: spacing.xs,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <AppIcon name="sparkles" color={theme.colors.accent} size={14} />
          <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.mutedText }}>
            {recommendation.summary}
          </AppText>
        </View>
      </View>

      {/* Recommendation slots + extra slots */}
      {[...recommendation.slots, ...extraSlots].map((slot) => {
        const selected = guidedAnchors[slot.id];
        const isExtra = !recommendation.slots.some((s) => s.id === slot.id);
        return (
          <View
            key={slot.id}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              borderRadius: 20,
              borderWidth: 1,
              padding: spacing.lg,
              gap: spacing.sm,
            }}>
            {/* Slot header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{
                backgroundColor: slot.required ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText style={{
                  color: slot.required ? theme.colors.inverseText : theme.colors.mutedText,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}>
                  {isExtra ? 'Extra' : slot.required ? 'Required' : 'Optional'}
                </AppText>
              </View>
              <AppText style={{
                color: theme.colors.mutedText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 10,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                {slot.category}
              </AppText>
            </View>

            <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
              {slot.label}
            </AppText>
            <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
              {slot.rationale}
            </AppText>

            {/* Selected item preview */}
            {selected ? (
              <View style={{ gap: spacing.sm }}>
                <AnchorChip anchor={selected} onRemove={() => onClearSlot(slot.id)} />
                <Pressable
                  onPress={() => onAddToSlot(slot.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppIcon name="refresh" color={theme.colors.accent} size={11} />
                  <AppText style={{
                    color: theme.colors.accent,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 12,
                  }}>
                    Replace item
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => onAddToSlot(slot.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 12,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  paddingVertical: spacing.md,
                }}>
                <AppIcon name="add" color={theme.colors.mutedText} size={14} />
                <AppText style={{
                  color: theme.colors.mutedText,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: 13,
                }}>
                  Add anchor piece
                </AppText>
              </Pressable>
            )}
          </View>
        );
      })}

      {/* Add extra anchor slot */}
      {recommendation.slots.length + extraSlots.length < numDays + 3 && (
        <Pressable
          onPress={onAddExtraSlot}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 14,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderStyle: 'dashed',
            paddingVertical: spacing.md,
          }}>
          <AppIcon name="add" color={theme.colors.mutedText} size={14} />
          <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
            Add anchor piece
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

// ── Auto mode panel ───────────────────────────────────────────────────────────

function AutoPanel({
  loadState,
  anchors,
  numDays,
  onRetry,
  onReplace,
  onAddAnchor,
}: {
  loadState: 'loading' | 'ready' | 'empty';
  anchors: SelectedAnchor[];
  numDays: number;
  onRetry:    (anchor: SelectedAnchor) => void;
  onReplace:  (anchor: SelectedAnchor) => void;
  onAddAnchor: () => void;
}) {
  const { theme } = useTheme();

  if (loadState === 'loading') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
        <ActivityIndicator color={theme.colors.accent} />
        <AppText style={{ color: theme.colors.mutedText, fontSize: 13 }}>
          Selecting anchors from your closet…
        </AppText>
      </View>
    );
  }

  if (loadState === 'empty' || anchors.length === 0) {
    return (
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.sm,
        alignItems: 'center',
      }}>
        <AppIcon name="closet" color={theme.colors.subtleText} size={24} />
        <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' }}>
          No closet items available yet. Switch to Guided or Manual mode to pick anchors manually.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 14,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
      }}>
        <AppIcon name="sparkles" color={theme.colors.accent} size={13} />
        <AppText style={{ flex: 1, color: theme.colors.mutedText, fontSize: 12, lineHeight: 18 }}>
          We will build your outfits around these core pieces. Use Try something else to swap any anchor.
        </AppText>
      </View>

      {anchors.map((anchor) => {
        const imageUri = anchor.source !== 'ai_suggested' ? (anchor.closetItemImageUrl ?? anchor.localImageUri ?? anchor.imageUrl) : undefined;
        return (
          <View
            key={anchor.id}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 20,
              borderWidth: 1,
              overflow: 'hidden',
            }}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={{ width: '100%', aspectRatio: 3 / 4 }}
                resizeMode="cover"
              />
            )}
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 999,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                }}>
                  <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {anchor.category}
                  </AppText>
                </View>
              </View>
              {/* Slot guidance — what Vesture was looking for */}
              {anchor.slotLabel && (
                <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
                  Looking for: {anchor.slotLabel}
                </AppText>
              )}
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                {anchor.source === 'ai_suggested' ? anchor.label : anchor.closetItemTitle ?? anchor.label}
              </AppText>
              {anchor.rationale && (
                <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
                  {anchor.rationale}
                </AppText>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                {/* Try something else */}
                {(() => {
                  const hasAlts = (anchor.alternates?.length ?? 0) > 0;
                  return (
                    <Pressable
                      onPress={() => hasAlts ? onRetry(anchor) : undefined}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        backgroundColor: theme.colors.subtleSurface,
                        borderColor: hasAlts ? theme.colors.accent : theme.colors.border,
                        borderRadius: 14,
                        borderWidth: 1,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.sm,
                        opacity: hasAlts ? 1 : 0.4,
                      }}>
                      <AppIcon name="refresh" color={hasAlts ? theme.colors.accent : theme.colors.subtleText} size={12} />
                      <AppText style={{
                        color: hasAlts ? theme.colors.accent : theme.colors.subtleText,
                        fontFamily: theme.fonts.sansMedium,
                        fontSize: 12,
                      }}>
                        {hasAlts ? 'Try something else' : 'Only match'}
                      </AppText>
                    </Pressable>
                  );
                })()}
                {/* Replace manually */}
                <Pressable
                  onPress={() => onReplace(anchor)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    backgroundColor: theme.colors.subtleSurface,
                    borderColor: theme.colors.border,
                    borderRadius: 10,
                    borderWidth: 1,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                  }}>
                  <AppIcon name="swap" color={theme.colors.text} size={12} />
                  <AppText style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 12,
                  }}>
                    Replace manually
                  </AppText>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      {/* Add extra anchor piece */}
      {anchors.length < numDays + 3 && (
        <Pressable
          onPress={onAddAnchor}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 14,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderStyle: 'dashed',
            paddingVertical: spacing.md,
          }}>
          <AppIcon name="add" color={theme.colors.mutedText} size={14} />
          <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
            Add anchor piece
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

// ── Manual mode panel ─────────────────────────────────────────────────────────

function ManualPanel({
  anchors,
  recommendation,
  numDays,
  onAdd,
  onRemove,
}: {
  anchors: SelectedAnchor[];
  recommendation: AnchorRecommendation;
  numDays: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { theme } = useTheme();
  const cap = numDays + 3;
  const atCap = anchors.length >= cap;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Guidance bar */}
      <View style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 14,
        padding: spacing.md,
        gap: spacing.xs,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppIcon name="sparkles" color={theme.colors.accent} size={13} />
          <AppText style={{ flex: 1, fontFamily: theme.fonts.sansMedium, fontSize: 12, color: theme.colors.mutedText }}>
            Recommended for this trip: {recommendation.minCount}–{recommendation.maxCount} anchors
          </AppText>
        </View>
        <AppText style={{ color: theme.colors.subtleText, fontSize: 11, marginLeft: spacing.lg + spacing.sm }}>
          Up to {cap} anchors for a {numDays}-day trip.
        </AppText>
      </View>

      {/* Hint chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {(['top', 'bottom', 'shoes', 'outerwear', 'bag'] as AnchorCategory[]).map((cat) => {
          const hasCat = anchors.some((a) => a.category === cat);
          return (
            <View
              key={cat}
              style={{
                backgroundColor: hasCat ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}>
              <AppText style={{
                color: hasCat ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 11,
              }}>
                {hasCat ? '✓ ' : ''}{cat}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Selected anchors */}
      {anchors.map((anchor) => (
        <AnchorChip key={anchor.id} anchor={anchor} onRemove={() => onRemove(anchor.id)} />
      ))}

      {/* Add button */}
      {!atCap && (
        <Pressable
          onPress={onAdd}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: theme.colors.subtleSurface,
            borderRadius: 14,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderStyle: 'dashed',
            paddingVertical: spacing.md,
          }}>
          <AppIcon name="add" color={theme.colors.mutedText} size={14} />
          <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
            Add anchor piece
          </AppText>
        </Pressable>
      )}

      {atCap && (
        <AppText style={{ color: theme.colors.accent, fontSize: 12, textAlign: 'center' }}>
          You have reached the maximum number of anchors for this trip.
        </AppText>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

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
