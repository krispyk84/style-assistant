import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAppSession } from '@/hooks/use-app-session';
import { useImagePicker } from '@/hooks/use-image-picker';
import type { LocalImageAsset } from '@/types/media';
import type { TripDraft } from '@/lib/trip-draft-storage';
import { tripDraftStorage } from '@/lib/trip-draft-storage';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import {
  nextAnchorSlot,
  rankCandidatesForSlot,
  recommendTripAnchors,
} from '@/lib/trip-anchor-recommender';
import type {
  AnchorCategory,
  AnchorRecommendation,
  AnchorSlot,
  ScoredAnchorCandidate,
} from '@/lib/trip-anchor-recommender';
import { closetService } from '@/services/closet';
import { saveTripPlanDraft, saveTripPlanAnchors } from '@/services/trip-plans';
import { tripOutfitsService } from '@/services/trip-outfits';
import type { TripAnchorInput } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';

// ── Types ─────────────────────────────────────────────────────────────────────

type AnchorMode = 'guided' | 'auto' | 'manual';

type SelectedAnchor = {
  id: string;
  slotId?: string;
  label: string;
  category: string;
  source: 'closet' | 'camera' | 'library' | 'ai_suggested';
  closetItemId?: string;
  closetItemTitle?: string;
  closetItemImageUrl?: string;
  localImageUri?: string;
  rationale?: string;
  /** What the slot is looking for (displayed above the item name in auto mode). */
  slotLabel?: string;
  slotRationale?: string;
  /** Scored alternates for "Try something else" (auto mode). */
  alternates?: ScoredAnchorCandidate[];
  /** Index of the alternate currently shown (-1 = showing best candidate). */
  alternateIndex?: number;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function AnchorChip({
  anchor,
  onRemove,
}: {
  anchor: SelectedAnchor;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const imageUri = anchor.closetItemImageUrl ?? anchor.localImageUri;

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
  onAddToSlot,
  onClearSlot,
}: {
  recommendation: AnchorRecommendation;
  guidedAnchors: Record<string, SelectedAnchor | undefined>;
  onAddToSlot: (slotId: string) => void;
  onClearSlot: (slotId: string) => void;
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

      {/* Slots */}
      {recommendation.slots.map((slot) => {
        const selected = guidedAnchors[slot.id];
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
                  {slot.required ? 'Required' : 'Optional'}
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
          We'll build your outfits around these core pieces. Tap "Try something else" to swap any anchor.
        </AppText>
      </View>

      {anchors.map((anchor) => {
        const imageUri = anchor.source !== 'ai_suggested' ? (anchor.closetItemImageUrl ?? anchor.localImageUri) : undefined;
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
        {(['top', 'bottom', 'shoes', 'outerwear'] as AnchorCategory[]).map((cat) => {
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
          You've reached the maximum number of anchors for this trip.
        </AppText>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function TripAnchorsScreen() {
  const { theme } = useTheme();
  const { profile } = useAppSession();

  // Mode is selected on the preceding /trip-mode screen and passed as a URL param
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = (modeParam ?? 'guided') as AnchorMode;

  // ── Draft loading ───────────────────────────────────────────────────────────

  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [draftError, setDraftError] = useState(false);

  useEffect(() => {
    tripDraftStorage.load().then((d) => {
      if (d) setDraft(d);
      else setDraftError(true);
    }).catch(() => setDraftError(true));
  }, []);

  // ── Closet loading ──────────────────────────────────────────────────────────

  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetLoaded, setClosetLoaded] = useState(false);

  useEffect(() => {
    closetService.getItems().then((res) => {
      if (res.success && res.data) setClosetItems(res.data.items ?? []);
    }).catch(() => {}).finally(() => setClosetLoaded(true));
  }, []);

  const hasClosetItems = closetItems.length > 0;

  // ── Recommendation ──────────────────────────────────────────────────────────

  const tripCtx = draft ? {
    numDays:        draft.numDays,
    destination:    draft.destinationLabel,
    purposes:       draft.purposes,
    willSwim:       draft.willSwim,
    fancyNights:    draft.fancyNights,
    workoutClothes: draft.workoutClothes,
    laundryAccess:  draft.laundryAccess,
    shoesCount:     draft.shoesCount,
    carryOnOnly:    draft.carryOnOnly,
    climateLabel:   draft.climateLabel,
    styleVibe:      draft.styleVibe,
    gender:         profile.gender as 'man' | 'woman' | 'non-binary' | undefined,
    avgHighC:       draft.avgHighC,
    avgLowC:        draft.avgLowC,
  } : null;

  const recommendation = tripCtx ? recommendTripAnchors(tripCtx) : null;

  // ── Anchor state by mode ────────────────────────────────────────────────────

  // Guided mode: map from slotId → selected anchor
  const [guidedAnchors, setGuidedAnchors] = useState<Record<string, SelectedAnchor>>({});

  // Auto mode: pre-filled list (may be swapped)
  const [autoAnchors, setAutoAnchors] = useState<SelectedAnchor[]>([]);
  const [autoLoadState, setAutoLoadState] = useState<'loading' | 'ready' | 'empty'>('loading');
  // Manual mode: free list
  const [manualAnchors, setManualAnchors] = useState<SelectedAnchor[]>([]);

  // ── Image picker ────────────────────────────────────────────────────────────

  const { image: pickedImage, pickFromLibrary, takePhoto } = useImagePicker();
  const pendingSlotRef = useRef<{ slotId: string; mode: AnchorMode; imageSource: 'camera' | 'library' } | null>(null);
  const prevImageUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pickedImage?.uri || pickedImage.uri === prevImageUriRef.current) return;
    prevImageUriRef.current = pickedImage.uri;
    const pending = pendingSlotRef.current;
    if (!pending) return;
    pendingSlotRef.current = null;
    addAnchorFromLocalImage(pending.slotId, pending.mode, pending.imageSource, pickedImage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedImage?.uri]);

  // ── Closet picker state ─────────────────────────────────────────────────────

  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const closetPickerTargetRef = useRef<{ slotId: string; mode: AnchorMode } | null>(null);

  // ── Source sheet state ──────────────────────────────────────────────────────

  const [sourceSheetVisible, setSourceSheetVisible] = useState(false);
  const sourceSheetTargetRef = useRef<{ slotId: string; mode: AnchorMode } | null>(null);

  // ── Auto-suggest on closet load + mode change ───────────────────────────────

  /**
   * Build auto-mode anchor suggestions using proper scoring.
   * For each slot: rank all eligible closet items by fit score (climate,
   * formality, color, metadata quality), pick the best unused candidate,
   * and stash the remaining ranked candidates as alternates for "Try something else".
   */
  const buildAutoSuggestions = useCallback((
    slots: ReturnType<typeof recommendTripAnchors>['slots'],
    items: ClosetItem[],
    ctx: NonNullable<typeof tripCtx>,
  ): SelectedAnchor[] => {
    if (items.length === 0) return [];
    const usedItemIds = new Set<string>();
    const anchors: SelectedAnchor[] = [];

    for (const slot of slots) {
      // Get all candidates ranked best-first (already filtered by category + gender)
      const allCandidates = rankCandidatesForSlot(items, slot, ctx);
      // Find the best candidate that hasn't been used by a previous slot
      const unusedCandidates = allCandidates.filter((c) => !usedItemIds.has(c.item.id));

      if (unusedCandidates.length > 0) {
        const best = unusedCandidates[0]!;
        usedItemIds.add(best.item.id);
        // All remaining ranked candidates become alternates (cycling them shows variety)
        const alternates = unusedCandidates.slice(1);
        anchors.push({
          id:                 `auto-${slot.id}`,
          slotId:             slot.id,
          label:              best.item.title,
          category:           slot.category,
          source:             'closet',
          closetItemId:       best.item.id,
          closetItemTitle:    best.item.title,
          closetItemImageUrl: best.item.sketchImageUrl ?? best.item.uploadedImageUrl ?? undefined,
          rationale:          best.rationale,
          slotLabel:          slot.label,
          slotRationale:      slot.rationale,
          alternates,
          alternateIndex:     -1,
        });
      } else {
        // No matching closet items — placeholder for this slot
        anchors.push({
          id:           `auto-${slot.id}`,
          slotId:       slot.id,
          label:        slot.label,
          category:     slot.category,
          source:       'ai_suggested',
          slotLabel:    slot.label,
          slotRationale: slot.rationale,
          rationale:    `We couldn't find a strong match for "${slot.label}" in your closet. You can add one below.`,
        });
      }
    }
    return anchors;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'auto' || !recommendation || !closetLoaded || !tripCtx) return;
    setAutoLoadState('loading');
    const suggestions = buildAutoSuggestions(recommendation.slots, closetItems, tripCtx);
    setAutoAnchors(suggestions);
    setAutoLoadState(suggestions.length === 0 ? 'empty' : 'ready');
  // tripCtx is derived from draft + profile; stable reference not needed since effect depends on mode/recommendation/closetItems
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recommendation, closetItems, closetLoaded, buildAutoSuggestions]);

  // ── Anchor mutations ────────────────────────────────────────────────────────

  function addAnchorFromClosetItem(slotId: string, anchorMode: AnchorMode, item: ClosetItem, slotLabel?: string) {
    const anchor: SelectedAnchor = {
      id:                 `anchor-${Date.now()}`,
      slotId:             slotId !== '__manual__' ? slotId : undefined,
      label:              item.title,
      category:           item.category ?? 'top',
      source:             'closet',
      closetItemId:       item.id,
      closetItemTitle:    item.title,
      closetItemImageUrl: item.sketchImageUrl ?? item.uploadedImageUrl ?? undefined,
    };
    applyAnchorToMode(slotId, anchorMode, anchor, slotLabel);
  }

  function addAnchorFromLocalImage(slotId: string, anchorMode: AnchorMode, imageSource: 'camera' | 'library', img: LocalImageAsset) {
    const catHint = getSlotCategory(slotId, anchorMode);
    const anchor: SelectedAnchor = {
      id:           `anchor-${Date.now()}`,
      slotId:       slotId !== '__manual__' ? slotId : undefined,
      label:        'Your picked piece',
      category:     catHint ?? 'top',
      source:       imageSource,
      localImageUri: img.uri,
    };
    applyAnchorToMode(slotId, anchorMode, anchor);
  }

  function getSlotCategory(slotId: string, anchorMode: AnchorMode): string | undefined {
    if (anchorMode === 'guided' && recommendation) {
      return recommendation.slots.find((s) => s.id === slotId)?.category;
    }
    return undefined;
  }

  function applyAnchorToMode(slotId: string, anchorMode: AnchorMode, anchor: SelectedAnchor, _slotLabel?: string) {
    if (anchorMode === 'guided') {
      setGuidedAnchors((prev) => ({ ...prev, [slotId]: anchor }));
    } else if (anchorMode === 'auto') {
      setAutoAnchors((prev) => prev.map((a) => a.slotId === slotId ? { ...anchor, slotId: a.slotId } : a));
    } else {
      setManualAnchors((prev) => [...prev, anchor]);
    }
  }

  function openSourceSheet(slotId: string, targetMode: AnchorMode) {
    sourceSheetTargetRef.current = { slotId, mode: targetMode };
    setSourceSheetVisible(true);
  }

  function handlePickCamera() {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    pendingSlotRef.current = { ...target, imageSource: 'camera' };
    void takePhoto();
  }

  function handlePickLibrary() {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    pendingSlotRef.current = { ...target, imageSource: 'library' };
    void pickFromLibrary();
  }

  function handlePickCloset() {
    const target = sourceSheetTargetRef.current;
    if (!target) return;
    closetPickerTargetRef.current = target;
    setClosetPickerVisible(true);
  }

  function handleClosetItemSelected(item: ClosetItem) {
    const target = closetPickerTargetRef.current;
    if (!target) return;
    closetPickerTargetRef.current = null;
    setClosetPickerVisible(false);
    addAnchorFromClosetItem(target.slotId, target.mode, item);
  }

  // Auto mode: "Try something else" — cycle through scored alternates for this slot
  function handleAutoRetry(anchor: SelectedAnchor) {
    const alternates = anchor.alternates ?? [];
    if (alternates.length === 0) return;

    const currentIdx = anchor.alternateIndex ?? -1;
    const nextIdx = (currentIdx + 1) % alternates.length;
    const next = alternates[nextIdx]!;

    setAutoAnchors((prev) =>
      prev.map((a) =>
        a.id === anchor.id
          ? {
              ...a,
              label:              next.item.title,
              source:             'closet',
              closetItemId:       next.item.id,
              closetItemTitle:    next.item.title,
              closetItemImageUrl: next.item.sketchImageUrl ?? next.item.uploadedImageUrl ?? undefined,
              rationale:          next.rationale,
              alternateIndex:     nextIdx,
            }
          : a
      )
    );
  }

  // Auto mode: "Replace manually" → open source sheet for that slot
  function handleAutoReplace(anchor: SelectedAnchor) {
    const slotId = anchor.slotId ?? anchor.id;
    openSourceSheet(slotId, 'auto');
  }

  // Auto mode: "Add anchor piece" → generate next logical slot and open source sheet
  function handleAddAutoAnchor() {
    if (!tripCtx || !recommendation) return;
    const usedIds = autoAnchors.map((a) => a.slotId ?? a.id);
    const slot = nextAnchorSlot(tripCtx, usedIds);
    // Best closet match for this new slot (if any) — auto-pick it
    const candidates = rankCandidatesForSlot(closetItems, slot, tripCtx);
    const usedItemIds = new Set(autoAnchors.map((a) => a.closetItemId).filter(Boolean));
    const best = candidates.find((c) => !usedItemIds.has(c.item.id));
    if (best) {
      setAutoAnchors((prev) => [
        ...prev,
        {
          id:                 `auto-extra-${Date.now()}`,
          slotId:             slot.id,
          label:              best.item.title,
          category:           slot.category,
          source:             'closet',
          closetItemId:       best.item.id,
          closetItemTitle:    best.item.title,
          closetItemImageUrl: best.item.sketchImageUrl ?? best.item.uploadedImageUrl ?? undefined,
          rationale:          best.rationale,
          slotLabel:          slot.label,
          slotRationale:      slot.rationale,
          alternates:         candidates.slice(candidates.indexOf(best) + 1),
          alternateIndex:     -1,
        },
      ]);
    } else {
      // No closet match — open source sheet for manual selection
      openSourceSheet(slot.id, 'auto');
    }
  }

  // ── Active anchors for the current mode ─────────────────────────────────────

  const activeAnchors: SelectedAnchor[] = (() => {
    if (mode === 'guided') return Object.values(guidedAnchors);
    if (mode === 'auto') return autoAnchors;
    return manualAnchors;
  })();

  // ── Validation ──────────────────────────────────────────────────────────────

  const manualCap = (draft?.numDays ?? 7) + 3;
  const manualExceedsCap = mode === 'manual' && manualAnchors.length > manualCap;

  const canContinue = (() => {
    if (!draft) return false;
    if (manualExceedsCap) return false;
    // Auto mode: wait for suggestions to finish loading before allowing continue
    if (mode === 'auto') return autoLoadState !== 'loading';
    return true;
  })();

  // ── Generation ──────────────────────────────────────────────────────────────

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Backend plan ID (fire-and-forget save)
  const planIdRef = useRef<string | null>(null);

  // Save draft to backend on load (fire-and-forget)
  useEffect(() => {
    if (!draft) return;
    saveTripPlanDraft({
      destination:    draft.destinationLabel,
      country:        draft.country,
      departureDate:  draft.departureDate,
      returnDate:     draft.returnDate,
      numDays:        draft.numDays,
      travelParty:    draft.travelParty,
      purposes:       draft.purposes,
      climateLabel:   draft.climateLabel,
      styleVibe:      draft.styleVibe,
      willSwim:       draft.willSwim,
      fancyNights:    draft.fancyNights,
      workoutClothes: draft.workoutClothes,
      laundryAccess:  draft.laundryAccess,
      shoesCount:     draft.shoesCount,
      carryOnOnly:    draft.carryOnOnly,
      activities:     draft.activities,
      dressCode:      draft.dressCode,
      specialNeeds:   draft.specialNeeds,
      anchorMode:     mode,
    }).then((id) => { planIdRef.current = id; });
  // only run once when draft is first loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.draftId]);

  async function handleContinue() {
    if (!draft || !canContinue) return;
    setIsGenerating(true);
    setGenerateError(null);

    const anchorInputs: TripAnchorInput[] = activeAnchors.map((a) => ({
      label:        a.label,
      category:     a.category,
      source:       a.source as TripAnchorInput['source'],
      closetItemId: a.closetItemId,
      rationale:    a.rationale,
    }));

    const tripId = `trip-${Date.now()}`;

    try {
      // Persist anchors to backend (fire-and-forget)
      if (planIdRef.current) {
        void saveTripPlanAnchors(planIdRef.current, mode, anchorInputs);
      }

      // Save anchors to draft so results screen can run progressive generation
      await tripDraftStorage.save({
        ...draft,
        pendingAnchors:     anchorInputs.length > 0 ? anchorInputs : undefined,
        pendingAnchorMode:  mode,
      });

      // Navigate immediately — results screen handles day-by-day generation
      router.push({
        pathname: '/trip-results',
        params: { tripId, destination: draft.destinationLabel, isProgressiveGeneration: '1' },
      });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
            {mode === 'guided' && (
              <GuidedPanel
                recommendation={recommendation}
                guidedAnchors={guidedAnchors}
                onAddToSlot={(slotId) => openSourceSheet(slotId, 'guided')}
                onClearSlot={(slotId) => setGuidedAnchors((prev) => {
                  const next = { ...prev };
                  delete next[slotId];
                  return next;
                })}
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
            You've reached the maximum number of anchors for this trip.
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
          disabled={!canContinue || isGenerating}
          onPress={() => void handleContinue()}
          style={{
            backgroundColor: canContinue && !isGenerating ? theme.colors.text : theme.colors.subtleSurface,
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
              color={canContinue ? theme.colors.inverseText : theme.colors.subtleText}
              size={15}
            />
          )}
          <AppText style={{
            color: canContinue && !isGenerating ? theme.colors.inverseText : theme.colors.subtleText,
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
