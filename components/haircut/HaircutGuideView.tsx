import { Image } from 'expo-image';
import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { FullscreenNavArrows } from '@/components/ui/fullscreen-nav-arrows';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import type { HaircutAngleShots, HaircutGuideResponse, HaircutOption } from '@/types/api';

type HaircutGuideViewProps = {
  option: HaircutOption;
  guide: HaircutGuideResponse;
  angleShots: HaircutAngleShots | null;
  isLoadingAngleShots: boolean;
  angleShotsError: string | null;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onUnsave: () => void;
  /** Hidden during the ViewShot capture used for "Save to Photos"/"Share" — an
   * app-only control has no place baked into the exported barber-guide image. */
  hideSaveButton?: boolean;
};

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.6 }}>{title}</AppText>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <AppText key={item} style={{ fontSize: 13, lineHeight: 19 }}>{'•  '}{item}</AppText>
      ))}
    </View>
  );
}

type PhotoTile = { key: string; label: string; option: HaircutOption | null };

// Square tiles, contain (never crop) — the generated image's real dimensions
// aren't guaranteed to match a square exactly, and cropping was cutting into
// the subject off-center. contain always shows the whole image, at the cost
// of a small letterbox margin if the source isn't quite square.
function AnglePhoto({ label, option, selected, onPress }: { label: string; option: HaircutOption | null; selected: boolean; onPress: () => void }) {
  const ready = option?.status === 'ready' && !!option.imageUrl;
  return (
    <Pressable onPress={ready ? onPress : undefined} style={{ flex: 1, gap: 4 }}>
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: theme.colors.card,
          borderRadius: 14,
          borderWidth: selected ? 2 : 0,
          borderColor: theme.colors.accent,
          overflow: 'hidden',
          width: '100%',
        }}>
        {ready ? (
          <Image contentFit="contain" source={{ uri: option!.imageUrl! }} style={{ height: '100%', width: '100%' }} />
        ) : option?.status === 'failed' ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <AppIcon color={theme.colors.subtleText} name="warning" size={18} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
          </View>
        )}
      </View>
      <AppText tone={selected ? undefined : 'subtle'} style={{ fontSize: 10, textAlign: 'center' }}>{label}</AppText>
    </Pressable>
  );
}

export function HaircutGuideView({ option, guide, angleShots, isLoadingAngleShots, angleShotsError, isSaved, isSaving, onSave, onUnsave, hideSaveButton = false }: HaircutGuideViewProps) {
  const photos: PhotoTile[] = [
    { key: 'front', label: 'Front', option },
    { key: 'top', label: 'Top', option: angleShots?.top ?? null },
    { key: 'side', label: 'Side', option: angleShots?.side ?? null },
    { key: 'back', label: 'Back', option: angleShots?.back ?? null },
  ];
  const [selectedKey, setSelectedKey] = useState('front');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selectedPhoto = photos.find((photo) => photo.key === selectedKey) ?? photos[0]!;
  const mainReady = selectedPhoto.option?.status === 'ready' && !!selectedPhoto.option.imageUrl;

  // Prev/next in the fullscreen viewer cycles through whichever angles are
  // actually ready — skipping over any still-pending or failed shots.
  const readyPhotos = photos.filter((photo) => photo.option?.status === 'ready' && !!photo.option.imageUrl);
  const readyIndex = readyPhotos.findIndex((photo) => photo.key === selectedKey);
  function goToReadyOffset(offset: number) {
    const next = readyPhotos[readyIndex + offset];
    if (next) setSelectedKey(next.key);
  }

  return (
    <View style={{ alignSelf: 'center', backgroundColor: theme.colors.background, gap: spacing.lg, padding: spacing.lg, width: 360 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText tone="muted" variant="eyebrow" style={{ letterSpacing: 2.4 }}>HAIRCUT GUIDE</AppText>
        <AppText variant="heroSmall" style={{ textAlign: 'center' }}>{option.styleLabel}</AppText>
      </View>

      {mainReady ? (
        <Pressable onPress={() => setFullscreenOpen(true)}>
          <View style={{ aspectRatio: 1, backgroundColor: theme.colors.card, borderRadius: 20, overflow: 'hidden', width: '100%' }}>
            <Image contentFit="contain" source={{ uri: selectedPhoto.option!.imageUrl! }} style={{ height: '100%', width: '100%' }} />
          </View>
        </Pressable>
      ) : null}

      {angleShots || isLoadingAngleShots ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {photos.map((photo) => (
            <AnglePhoto
              key={photo.key}
              label={photo.label}
              option={photo.option}
              selected={photo.key === selectedKey}
              onPress={() => setSelectedKey(photo.key)}
            />
          ))}
        </View>
      ) : angleShotsError ? (
        <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>{angleShotsError}</AppText>
      ) : null}

      {hideSaveButton ? null : (
        <PrimaryButton
          label={isSaved ? 'Saved' : 'Save Haircut'}
          onPress={isSaved ? onUnsave : onSave}
          variant={isSaved ? 'secondary' : 'primary'}
          disabled={isSaving}
        />
      )}

      <Modal visible={fullscreenOpen} animationType="fade" transparent onRequestClose={() => setFullscreenOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <Pressable
            hitSlop={12}
            onPress={() => setFullscreenOpen(false)}
            style={{
              alignSelf: 'flex-end',
              // Modal content renders outside the normal safe-area tree on iOS, so
              // insets.top can read as 0 here even though the modal draws under the
              // status bar — fall back to a fixed clearance if insets look unset.
              paddingTop: Math.max(insets.top, 50) + spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.sm,
            }}>
            <AppIcon color="#fff" name="close" size={28} />
          </Pressable>
          {mainReady ? (
            <View style={{ flex: 1 }}>
              <Image
                contentFit="contain"
                source={{ uri: selectedPhoto.option!.imageUrl! }}
                style={{ flex: 1, width: '100%' }}
              />
              <FullscreenNavArrows
                canGoPrev={readyIndex > 0}
                canGoNext={readyIndex >= 0 && readyIndex < readyPhotos.length - 1}
                onPrev={() => goToReadyOffset(-1)}
                onNext={() => goToReadyOffset(1)}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      <Section title="THE LOOK">
        <AppText style={{ fontSize: 14, lineHeight: 20 }}>{guide.theLook}</AppText>
      </Section>

      <Section title="WHAT TO ASK FOR">
        <BulletList items={guide.whatToAskFor} />
      </Section>

      <Section title="CUT DETAILS">
        <BulletList items={guide.cutDetails} />
      </Section>

      <Section title="STYLING TIPS">
        <BulletList items={guide.stylingTips} />
      </Section>

      <Section title="WHAT TO AVOID">
        <BulletList items={guide.whatToAvoid} />
      </Section>

      <Section title="MAINTENANCE">
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{guide.maintenance}</AppText>
      </Section>

      <Section title="PRODUCTS">
        <BulletList items={guide.products} />
      </Section>
    </View>
  );
}
